const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const changeLogPath = path.join(root, 'CHANGELOG.md');
const claudePath = path.join(root, 'CLAUDE.md');
const promptPath = path.join(root, 'CLAUDE_CODE_PROMPT.txt');

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Erreur lors de la lecture de ${filePath}:`, error.message);
    process.exit(1);
  }
}

function parseHeadings(markdown, level = 2) {
  const regex = new RegExp(`^#{${level}}\\s+(.*)$`, 'gm');
  const headings = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    headings.push(match[1].trim());
  }
  return headings;
}

function parsePendingTasks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const tasks = [];
  let currentHeading = 'Global';
  let currentSubheading = null;

  lines.forEach((line) => {
    const headingMatch = line.match(/^##+\s+(.*)$/);
    if (headingMatch) {
      currentHeading = headingMatch[1].trim();
      currentSubheading = null;
      return;
    }

    const subheadingMatch = line.match(/^###\s+(.*)$/);
    if (subheadingMatch) {
      currentSubheading = subheadingMatch[1].trim();
      return;
    }

    const taskMatch = line.match(/^- \[ \] \*\*(.*?\*\*):?\s*(.*)$/);
    if (taskMatch) {
      const title = taskMatch[1].trim();
      const details = taskMatch[2].trim();
      tasks.push({
        heading: currentHeading,
        subheading: currentSubheading,
        title,
        details,
        raw: line.trim(),
      });
      return;
    }

    const genericTaskMatch = line.match(/^- \[ \] (.*)$/);
    if (genericTaskMatch) {
      tasks.push({
        heading: currentHeading,
        subheading: currentSubheading,
        title: genericTaskMatch[1].trim(),
        details: '',
        raw: line.trim(),
      });
    }
  });

  return tasks;
}

function formatTask(task, index) {
  const prefix = `${index + 1}.`;
  const context = task.subheading ? `${task.heading} > ${task.subheading}` : task.heading;
  const description = task.details ? `${task.title} ${task.details}` : task.title;
  return `${prefix} [${context}] ${description}`;
}

function summarizeTasks(tasks) {
  const summary = new Map();
  tasks.forEach((task) => {
    const key = task.subheading ? `${task.heading} > ${task.subheading}` : task.heading;
    summary.set(key, (summary.get(key) || 0) + 1);
  });

  const lines = [`Total de tâches non terminées : ${tasks.length}`];
  summary.forEach((count, section) => {
    lines.push(`- ${count} tâche(s) dans « ${section} »`);
  });

  return lines;
}

function buildPrompt(tasks) {
  if (tasks.length === 0) {
    return 'Aucune tâche non faite trouvée dans CLAUDE.md. Le dossier est à jour.';
  }

  const lines = [
    'Demande à Claude Code de démarrer les tâches suivantes :',
    '',
    'Résumé des tâches :',
    ...summarizeTasks(tasks),
    '',
    'Tâches non terminées :',
  ];

  tasks.forEach((task, index) => {
    lines.push(`- ${formatTask(task, index)}`);
  });

  lines.push('', 'Contexte : lire `CHANGELOG.md` et `CLAUDE.md` avant de commencer.', 'Demande une première action claire pour chaque tâche.');
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const sectionArgIndex = args.indexOf('--section');
  const writeArg = args.includes('--write');
  const sectionName = sectionArgIndex >= 0 ? args[sectionArgIndex + 1] : null;

  const changelog = readFile(changeLogPath);
  const claude = readFile(claudePath);

  const changelogHeadings = parseHeadings(changelog, 2);
  const claudeHeadings = parseHeadings(claude, 2);
  const pendingTasks = parsePendingTasks(claude);

  console.log('\n=== Lecture automatique de CHANGELOG.md et CLAUDE.md ===\n');
  console.log('CHANGELOG.md - Sections détectées :');
  changelogHeadings.forEach((heading) => console.log(`- ${heading}`));
  console.log('\nCLAUDE.md - Sections détectées :');
  claudeHeadings.forEach((heading) => console.log(`- ${heading}`));

  let tasksToShow = pendingTasks;
  if (sectionName) {
    const normalizedSection = sectionName.toLowerCase();
    tasksToShow = pendingTasks.filter((task) =>
      task.heading.toLowerCase().includes(normalizedSection) ||
      (task.subheading && task.subheading.toLowerCase().includes(normalizedSection))
    );

    console.log(`\nTâches non faites filtrées par section : ${sectionName}`);
  } else {
    console.log('\nTâches non faites détectées :');
  }

  if (tasksToShow.length === 0) {
    console.log('- Aucune tâche non faite trouvée.');
  } else {
    tasksToShow.forEach((task, index) => {
      console.log(`- ${formatTask(task, index)}`);
    });
  }

  const prompt = buildPrompt(tasksToShow);
  console.log('\n=== Prompt Claude Code généré ===\n');
  console.log(prompt);

  if (writeArg) {
    try {
      fs.writeFileSync(promptPath, prompt + '\n', 'utf8');
      console.log(`\nPrompt sauvegardé dans ${promptPath}`);
    } catch (error) {
      console.error('Impossible d\'enregistrer le prompt :', error.message);
    }
  }

  console.log('\n=== Fin de la revue ===\n');
}

main();
