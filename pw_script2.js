process.stdout.write('a\n');
const {chromium} = require('playwright');(async()=>{
	const b = await chromium.launch({headless:true});
	const p = await b.newPage();
	const c = await p.context().newCDPSession(p);
	const msgs = [];
	const excs = [];
	c.on('Runtime.consoleAPICalled', function(ev) {
		var txt = ev.args.map(function(a) { return String(a.value || a.description || ''); }).join(' ').substring(0,400);
		msgs.push({t:ev.type, m:txt});
	});
	c.on('Runtime.exceptionThrown', function(ev) {
		excs.push({text: ev.exceptionDetails.text, line: ev.exceptionDetails.lineNumber, col: ev.exceptionDetails.columnNumber, stack: (ev.exceptionDetails.stackTrace ? ev.exceptionDetails.stackTrace.description || '' : '').substring(0,1500)});
	});
	await p.goto('https://pariscore.fr/setpoint/', {timeout:10000});
	await c.send('Console.enable');
	await c.send('Runtime.enable');
	await new Promise(function(r) { setTimeout(r, 8000); });

	// Get detailed page state
	var pageState = await c.send('Runtime.evaluate', {expression: '
        JSON.stringify({
          title: document.title,
          h1: document.querySelector("h1")?.textContent || null,
          subtext: document.body.innerText.substring(0,3000),
          emailBtn: !!document.querySelector('a[href*="mailto"]'),
          retryBtns:  document.body.innerText.includes("Réessayer"),
          mailtoLnk, document.querySelector("a[href*=\"mailto\"]")?.href || null,
          skeletons: document.querySelectorAll("[class*=skeleton]").length,
          buttons: document.querySelectorAll("button").length,
          errorUIText: document.querySelector("[class*=error]")?.textContent || null,
          debugInfo: document.querySelector("[data-reduct-component-error]")?.textContent || null,
          alert: document.querySelector("[role=alert]")?.textContent || null,
          noSupport: document.querySelector("[class*=no-support]")?.textContent || null
        })
    ', timeout:2000, returnByValue:true});
	process.stdout.write('PAGE_STATE: ' + pageState.result.value + '\n');

	// Check for __NEXT_DATA__
	try {
		var nextData = await c.send('Runtime.evaluate', {expression: '
          (function() {
            try {
              var nd = window.__NEXT_DATA__;
              if (!nd) return "NO_NEXT_DATA";
              return JSON.stringify({
                page: nd.page,
                buildId: nd.buildId,
                hasProps: !!nd.props,
                propsKeys: nd.props ? Object.keys(nd.props).join(",") : null,
                pagePropsKeys: nd.props?.pageProps ? Object.keys(nd.props.pageProps).join(",") : null,
                statusCode: nd.props?.pageProps?.statusCode || null,
                error: nd.props?.pageProps?.error || null
              });
            } catch(e) { return "ERROR: " + e.message; }
          })()
        ', timeout:2000, returnByValue:true});
		process.stdout.write('NEXT_DATA: ' + nextData.result.value + '\n');
	} catch(e) { process.stdout.write('NEXT:ERR:' + e.message + '\n'); }

	// Check for Sentry
	try {
		var sentry = await c.send('Runtime.evaluate', {expression: '
          (function() {
            try {
              if (typeof window.Sentry === "undefined") return "NO_SENTRY";
              return JSON.stringify({
                lastEventId: typeof window.Sentry.lastEventId === "function" ? window.Sentry.lastEventId() : null,
                hasScope: !!window.Sentry.getCurrentHub,
                dhTotal: typeof window.Sentry.getCurrentHub === "function" ? window.Sentry.getCurrentHub()?.datak[0]?.length : null : null
              });
            } catch(e) { return "SENTRY_ERR: " + e.message; }
          })()
        ', timeout:2000, returnByValue:true});
		process.stdout.write('SENTRY: ' + sentry.result.value + '\n');
	} catch(e) { process.stdout.write('SENTRY:ERR:' + e.message + '\n'); }

	// Capture full stack trace from console error
	for (var i = 0; i < msgs.length && i < 30; i++) {
		process.stdout.write('MSG_' + i + ': ' + msgs[i].t + ': ' + String(msgs[i].m) + '\n');
	}

	process.stdout.write('NUM_EXCEPTIONS: ' + excs.length + '\n');
	for (var i = 0; i < excs.length && i < 10; i++) {
		process.stdout.write('EX__' + i + ': ' + String(excs[i].text) + ' ' + (excs[i].line || '') + ':' + (excs[i].col || '') + '\n');
		process.stdout.write('STACK__' + i + ': ' + String(excs[i].stack) + '\n');
	}

	await b.close();
	process.stdout.write('done\n');
})().catch(function(e) { process.stdout.write('ERR:' + String(e.message).substring(0,300) + '\n'); });
