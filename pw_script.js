process.stdout.write('a\n');
const {chromium} = require('playwright');(async()=>{
	const b = await chromium.launch({headless:true});
	const p = await b.newPage();
	const c = await p.context().newCDPSession(p);
	const msgs = [];
	const excs = [];
	c.on('Runtime.consoleAPICalled', function(ev) {
		var txt = ev.args.map(function(a) { return String(a.value || a.description || ''); }).join(' ').substring(0,300);
		msgs.push({t:ev.type, m:txt});
	});
	c.on('Runtime.exceptionThrown', function(ev) {
		excs.push({text: ev.exceptionDetails.text, stack: (ev.exceptionDetails.stackTrace ? ev.exceptionDetails.stackTrace.description || '' : '').substring(0,800)});
	});
	await p.goto('https://pariscore.fr/setpoint/', {timeout:10000});
	await c.send('Console.enable');
	await c.send('Runtime.enable');
	await new Promise(function(r) { setTimeout(r, 8000); });
	var hasErr = await c.send('Runtime.evaluate', {expression:'document.body.innerText.includes("Une erreur")', timeout:2000, returnByValue:true});
	process.stdout.write('HAS_ERR: ' + hasErr.result.value + '\n');
	var hasRetry = await c.send('Runtime.evaluate', {expression:'document.body.innerText.includes("Réessayer")', timeout:2000, returnByValue:true});
	process.stdout.write('HAS_RETRY: ' + hasRetry.result.value + '\n');
	process.stdout.write('CONSOLE: ' + msgs.length + '\n');
	for (var i = 0; i < msgs.length && i < 30; i++) {
		process.stdout.write('  ' + msgs[i].t + ': ' + String(msgs[i].m) + '\n');
	}
	process.stdout.write('EXCEPTIONS: ' + excs.length + '\n');
	for (var i = 0; i < excs.length && i < 10; i++) {
		process.stdout.write('  ' + String(excs[i].text) + '\n  STACK: ' + String(excs[i].stack).substring(0,500) + '\n');
	}
	await b.close();
	process.stdout.write('done\n');
})().catch(function(e) { process.stdout.write('ERR:' + String(e.message).substring(0,300) + '\n'); });
