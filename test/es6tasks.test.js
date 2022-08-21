const Task = require( "../src/es6tasks.js" );

// ---------------------------------------------------------------------------
function delay( dtm ){
	return new Promise(( fOk ) => setTimeout( fOk, dtm ));
}

function fpDelay( dtm, dtmReport = 100 ){
	return new Task( async (fResolve, fReject, fReport) => {
		if ( dtmReport <= 0 ) {
			dtmReport = dtm;
		}
		
		let dtmSlept = 0;
		let f = () => {
			let r = dtm > 0 ? dtmSlept / dtm : 0;
			if ( dtmReport < dtm ){
				fReport( r );
			}
			if ( dtmSlept < ( dtm - dtmReport )){
				dtmSlept += dtmReport;
				setTimeout( f, dtmReport );
			}
			else if (dtmSlept < dtm ){
				setTimeout( f, dtm - dtmSlept );
				dtmSlept = dtm;
			}
			else{
				fResolve();
			}
		}
		f();
	});
}


// ---------------------------------------------------------------------------
test("simple syncronous task progress reports", async ()=>{
	let s = "";
	
	const task = new Task((fOk, fErr, fReport)=>{
		fReport("here")
		fOk();
	});
	task.progress(( x ) => s = x);
	
	expect( s ).toBe( "here" );
});


// ---------------------------------------------------------------------------
test("multple syncronous task reports all get captured", async ()=>{
	let s = "";
	
	const task = new Task((fOk, fErr, fReport)=>{
		fReport("here1")
		fReport("here2")
		fOk();
	});
	task.progress(( x ) => s += x);
	
	expect( s ).toBe( "here1here2" );
});

// ---------------------------------------------------------------------------
test("simple asyncronous task reports", async ()=>{
	let s = "";
	
	const task = new Task((fOk, fErr, fReport)=>{
		setTimeout(()=>{
			fReport( "here" )
			fOk("done");
		}, 100);
	});
	
	task.progress(( x ) => s += x + ":");
	task.then(( x ) => s += x);

	await task;
	
	expect( s ).toBe( "here:done" );
});


// ---------------------------------------------------------------------------
test("simple multiple asyncronous task reports", async ()=>{
	let s = "";
	
	const task = new Task(async (fOk, fErr, fReport)=>{
		fReport( "here0" )
		await delay( 10 );
		fReport( "here1" )
		await delay( 10 );
		fReport( "here2" )
		fOk("done");
	});
	
	task.progress(( x ) => s += x + ":");
	task.then(( x ) => s += x);

	await task;
	
	expect( s ).toBe( "here0:here1:here2:done" );
});

// ---------------------------------------------------------------------------
test("tasks report 0", async ()=>{
	let s = "";
	
	const task = new Task(async (fOk, fErr, fReport)=>{
		fReport( 0 )
		await delay( 10 );
		fReport( 0 )
		fOk("done");
	}).then( x => x );
	
	task.progress(( x ) => s += x + ":");
	task.then(( x ) => s += x);

	await task;
	
	expect( s ).toBe( "0:0:done" );
});

// ---------------------------------------------------------------------------
test("promise chains", async ()=>{
	let s = "";
	
	const task = new Task(async (fOk, fErr, fReport)=>{
		await delay( 10 );
		fReport( 1 )
		await delay( 10 );
		fReport( 2 )
		fOk("done");
	});
	
	task
		.progress(( x ) => x * 1000)
		.progress(( x ) => "--" + x + "--" )
		.progress(( x ) => s += x + ":");

	task.then(( x ) => s += x);

	await task;
	
	expect( s ).toBe( "--1000--:--2000--:done" );
});

// ---------------------------------------------------------------------------
test("rejections", async ()=>{
	let s = "";
	
	const task = new Task(async (fOk, fErr, fReport)=>{
		await delay( 10 );
		fReport( 1 )
		await delay( 10 );
		fReport( 2 )
		fErr("done");
	})
		.progress(( x ) => s += x + ":")
		.then(( x ) => s += "resolved:" + x)
		.catch(( x ) => s += "rejected:" + x)

	await task;
	
	expect( s ).toBe( "1:2:rejected:done" );
});

// ---------------------------------------------------------------------------
test("finally", async ()=>{
	let s = "";
	
	const task = new Task(async (fOk, fErr, fReport)=>{
		await delay( 10 );
		fReport( 1 )
		await delay( 10 );
		fReport( 2 )
		fErr("done");
	})
		.progress(( x ) => s += x + ":")
		.then(( x ) => s += "resolved:" + x + ":")
		.catch(( x ) => s += "rejected:" + x + ":")
		.finally(() => s += "finally" )
			
	await task;
	
	expect( s ).toBe( "1:2:rejected:done:finally" );
});


// ---------------------------------------------------------------------------
test("then chaining to new Task", async ()=>{
	let s = "";
	
	const task = new Task(async (fOk, fErr, fReport)=>{
		await delay( 10 );
		fReport( "progA" )
		await delay( 10 );
		fReport( "progB" )
		fOk("done1");
	})
		.progress(( x ) => s += "H1=" + x + ", ")
		.progress(( x ) => undefined )
		.then(
			()=>new Task(
				async (fOk, fErr, fReport)=>{
					await delay( 10 );
					fReport( "progC" )
					await delay( 10 );
					fReport( "progD" )
					fOk("done2");
				}
			),
			undefined,
			{ started : "Started", done : "Done" }
		)
		.progress(( x ) => s += 'H2=' + x + ", ")
		.finally(() => s += "finally" )
			
	await task;
	
	expect( s ).toBe(
		"H1=progA, H1=progB, H2=Started, H2=progC, H2=progD, H2=Done, finally"
	);
});

// ---------------------------------------------------------------------------
test("then chaining to non-task", async ()=>{
	let s = "";
	
	const task = new Task(async (fOk, fErr, fReport)=>{
		await delay( 10 );
		fReport( "progA" )
		await delay( 10 );
		fReport( "progB" )
		fOk("done1");
	})
		.progress(( x ) => s += "H1=" + x + ", ")
		.progress(( x ) => undefined )
		.then(
			()=> 5,
			{ started : "Started", done : "Done" }
		)
		.progress(( x ) => s += 'H2=' + x + ", ")
		.finally(() => s += "finally" )
			
	await task;
	
	expect( s ).toBe(
		"H1=progA, H1=progB, H2=Started, H2=Done, finally"
	);
});

// ---------------------------------------------------------------------------
test("catch chaining to new Task", async ()=>{
	let s = "";
	
	const task = new Task(async (fOk, fErr, fReport)=>{
		await delay( 10 );
		fReport( "progA" )
		await delay( 10 );
		fReport( "progB" )
		fErr("done1");
	})
		.progress(( x ) => s += "H1=" + x + ", ")
		.progress(( x ) => undefined )
		.catch(
			()=>new Task(
				async (fOk, fErr, fReport)=>{
					fReport( "progC" )
					await delay( 10 );
					fReport( "progD" )
					await delay( 10 );
					fReport( "progE" )
					fOk("done2");
				}
			),
			{ started : "Started", done : "Done" }
		)
		.progress(( x ) => s += 'H2=' + x + ", ")
		.finally(() => s += "finally" )
			
	await task;
	
	expect( s ).toBe(
		"H1=progA, H1=progB, H2=Started, H2=progC, H2=progD, H2=progE, H2=Done, finally"
	);
});

// ---------------------------------------------------------------------------
test("catch chaining to non-task", async ()=>{
	let s = "";
	
	const task = new Task(async (fOk, fErr, fReport)=>{
		await delay( 10 );
		fReport( "progA" )
		await delay( 10 );
		fReport( "progB" )
		fErr("done1");
	})
		.progress(( x ) => s += "H1=" + x + ", ")
		.progress(( x ) => undefined )
		.catch(
			()=> 5,
			{ started : "Started", done : "Done" }
		)
		.progress(( x ) => s += 'H2=' + x + ", ")
		.finally(() => s += "finally" )
			
	await task;
	
	expect( s ).toBe(
		"H1=progA, H1=progB, H2=Started, H2=Done, finally"
	);
});

// ---------------------------------------------------------------------------
test("Task.allSettled", async ()=>{
	let s = "";
	
	await Task.allSettled([
		new Task(async (fOk, fErr, fReport)=>{
			fReport("p1");
			await delay( 10 );
			fErr("reject");
		}),
		new Task(async (fOk, fErr, fReport)=>{
			await delay( 20 );
			fReport("p2");
			await delay( 30 );
			fOk("success");
		})
	])
		.progress(( x ) => s += "H1=" + x.task + ":" + x.report + " ")
		.progress(( x ) => undefined )
		.then(( x ) => s += JSON.stringify( x ));
	
	expect( s ).toBe(
		'H1=0:p1 H1=1:p2 [{"status":"rejected","reason":"reject"},{"status":"fulfilled","value":"success"}]'
	);
});

// ---------------------------------------------------------------------------
test("Task.all", async ()=>{
	let s = "";
	
	await Task.all([
		new Task(async (fOk, fErr, fReport)=>{
			await delay( 100 );
			fReport("p1");
			await delay( 120 );
			fOk("success");
		}),
		new Task(async (fOk, fErr, fReport)=>{
			await delay( 2 );
			fReport("p2");
			await delay( 5 );
			fErr("reject");
		})
	])
		.progress(( x ) => s += "H1=" + x.task + ":" + x.report + " ")
		.then(( x ) => s += "SUCCESS:" + x )
		.catch(( x ) => s += "REJECT:" + x )
			;
	
	expect( s ).toBe(
		'H1=1:p2 REJECT:reject'
	);
});

