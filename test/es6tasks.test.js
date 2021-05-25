const Task = require( "../src/es6tasks.js" );

// ---------------------------------------------------------------------------
function delay( dtm ){
	return new Promise(( fOk ) => setTimeout( fOk, dtm ));
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
test("multple syncronous task reports only report the last", async ()=>{
	let s = "";
	
	const task = new Task((fOk, fErr, fReport)=>{
		fReport("here1")
		fReport("here2")
		fOk();
	});
	task.progress(( x ) => s += x);
	
	expect( s ).toBe( "here2" );
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
		await delay( 10 );
		fReport( "here1" )
		await delay( 10 );
		fReport( "here2" )
		fOk("done");
	});
	
	task.progress(( x ) => s += x + ":");
	task.then(( x ) => s += x);

	await task;
	
	expect( s ).toBe( "here1:here2:done" );
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
		.catch(
			()=>new Task(
				async (fOk, fErr, fReport)=>{
					await delay( 10 );
					fReport( "progC" )
					await delay( 10 );
					fReport( "progD" )
					fOk("done2");
				}
			),
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

