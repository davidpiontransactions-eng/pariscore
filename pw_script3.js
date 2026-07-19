process.stdout.write('a\n');
const {chromium} = require('playwright');(async()=>{
	const b = await chromium.launch({headless:true});
	const p = await b.newPage();
	const c = await p.context().newCDPSession(p);
	const msgs = [];
	c.on('Runtime.consoleAPICalled', function(ev) {
		var txt = ev.args.map(function(a) { return String(a.value || a.description || ''); }).join(' ').substring(0,500);
		msgs.push({t:ev.type, m:txt});
	});
	await p.goto('https://pariscore.fr/setpoint/', {timeout:10000});
	await c.send('Console.enable');
	await c.send('Runtime.enable');
	await new Promise(function(r) { setTimeout(r, 8000); });
	var hasErr = await c.send('Runtime.evaluate', {expression:'document.body.innerText.includes("Une erreur")', timeout:2000, returnByValue:true});
	process.stdout.write('HAS_ERR: ' + hasErr.result.value + '\n');
	var hasRetry = await c.send('Runtime.evaluate', {expression:'document.body.innerText.includes("Réessayer")', timeout:2000, returnByValue:true});
	process.stdout.write('HAS_RETRY: ' + hasRetry.result.value + '\n');
	var pageText = await c.send('Runtime.evaluate', {expression:'document.body.innerText.substring(0,2000)', timeout:2000, returnByValue:true});
	process.stdout.write('PAGE: ' + pageText.result.value + '\n');
	var title1 = await c.send('Runtime.evaluate', {expression:'document.title', timeout:2000, returnByValue:true});
	process.stdout.write('TITLE: ' + title1.result.value + '\n');
	var h1 = await c.send('Runtime.evaluate', {expression:'document.querySelector("h1")?.textContent || ""', timeout:2000, returnByValue:true});
	process.stdout.write('H1: ' + h1.result.value + '\n');
	var nextData1 = await c.send('Runtime.evaluate', {expression:'typeof window.__NEXT_DATA__ !== "undefined" ? "__NEXT_DATA___PRESENT" : "NO_NEXT_DATA"', timeout:2000, returnByValue:true});
	process.stdout.write('NEXT_DATA: ' + nextData1.result.value + '\n');
	var sentry1 = await c.send('Runtime.evaluate', {expression:'typeof window.Sentry !== "undefined" ? "SENTRY_PRESENT" : "NO_SENTRY"', timeout:2000, returnByValue:true});
	process.stdout.write('SENTRY: ' + sentry1.result.value + '\n');
	process.stdout.write('CONSOLE: ' + msgs.length + '\n');
	for (var i = 0; i < msgs.length && i < 30; i++) {
		process.stdout.write('  ' + msgs[i].t + ': ' + String(msgs[i].m) + '\n');
	}
	await b.close();
	process.stdout.write('done\n');
})().catch(function(e) { process.stdout.write('ERR:' + String(e.message).substring(0,300) + '\n'); });
