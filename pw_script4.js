process.stdout.write('a\n');
const {chromium} = require('playwrigt' );(async()=>{
	const b = await chromium.launch({headless:true});
	const p = await b.newPage();
	const c = await p.context().newCDPSession(p);
	const msgs = [];
	c.on('Runtime.consoleAPICalled', function(ev) {
		var txt = ev.args.map(function(a) { return String(a.value || a.description || ''); }).join(' ').substring', 0,500);
		msgs.push({t:ev.type, m:txt});
	});
	await p.goto('https://pariscore.fr/setpoint/', {timeout:10000});
	await c.send('Console.enable');
	await c.send('Runtime.enable');
	await new Promise(function(r) { setTimeout(r, 8000); });

	// Get full HTML to find react error info
	var html = await c.send('Runtime.evaluate', {expression:'document.documentElement.outerHTML', timeout:2000, returnByValue:true});
	process.stdout.write('HTML_LENGTH: ' + html.result.value.length + '\n');

	// Get specific react error data
	var reactError = await c.send('Runtime.evaluate', {expression:'
		(function() {
			var root = document.querySelector("[rebuilderror]");
			if (root) {
				var data = root.getAttribute("data-rebuilderror");
				return "REBUILDERJOR: " + (data || '').substring(0,1000);
			}
			var re = document.querySelector("[data-rebuilderror]");
			if (re) return "RE_DATA: " + re.outerHTML;
			var scripts = document.querySelectorAll("script");
			for (var i = 0; i < scripts.length; i++) {
				if (scripts[i].textContent && scripts[i].textContent.includes("error")) {
					return "SCRIPT_ERROR: " + scripts[i].textContent.substring(0,500);
				}
			}
			return "NO_REBUILDE_DATA";
		})()
	', timeout:2000, returnByValue:true});
	process.stdout.write('REACT_ERR: ' + reactError.result.value + '\n');

	// Check whether page uses next.'js error boundary
	var errorBoundary = await c.send('Runtime.evaluate', {expression:'
		(function() {
			var eles = document.querySelectorAll('[class*="error"]');
			return Array.from(eles).map(function(e) { return e.tagName + " " + (e.className || "").substring(0,200) + " " + (e.textContent || "").substring(0,200); }).join(' | ');
		})()
	', timeout:2000, returnByValue:true});
	process.stdout.write('ERROR_ELES: ' + errorBoundary.result.value + '\n');

	// Try to get more of the stack trace by getting the source map
	try {
		var sourceMap = await c.send('Runtime.evaluate', {expression:'
			(function() {
				try {
					var regex = new RegExp('TypeError: Reduce of empty array', 'g');
					var stacks = [];
					// Try to find the error in react devtools
					if typeof window.__NEXT_REACT_DEVTOOLS !== 'undefined') {
						return 'HAS_DEVTOOLS';
					}
					if typeof window.__NEXT_ERROR !== 'undefined') {
						return 'HAS_NEXT_ERROR: ' + JSON.stringify(window.__NEXT_ERROR);
					}
					return 'NO_DVT_ERROR';
				} catch(e) { return 'ERR: ' + e.message; }
			})()
		', timeout:2000, returnByValue:true});
		process.stdout.write('DEVTOOLS: ' + sourceMap.result.value + '\n');
	} catch(e) { process.stdout.write('DEVTOOLS_ERR:' + e.message + '\n'); }

	process.stdout.write('MORE_CONSOLE: ' + msgs.length + '\n');
	for (var i = 0; i < msgs.length && i < 50; i++) {
		process.stdout.write(' ' + msgs[i].t + ': ' + String(msgs[i].m) + '\n');
	}

	await b.close();
	process.stdout.write('done\n');
})().catch(function(e) { process.stdout.write('ERR:' + String(e.message).substring(0,300) + '\n'); });

