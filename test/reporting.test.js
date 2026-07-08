const Task = require( "../src/es6tasks.js" );

function fpDelay( dtm ){
	return new Promise(( fOk ) => setTimeout( fOk, dtm ));
}

test( "observer returning undefined does not starve later observers", async () => {
	const vx = [];
	const vxDerived = [];

	const task = new Task(( fOk, fErr, fReport ) => {
		fReport( 1 );
		fOk();
	});

	task
		.progress(() => undefined )
		.progress(( x ) => vx.push( x ));

	const taskDerived = task
		.then(( x ) => x )
		.progress(( x ) => vxDerived.push( x ));

	await taskDerived;
	await fpDelay( 5 );

	expect( vx ).toEqual([ 1 ]);
	expect( vxDerived ).toEqual([ 1 ]);
});

test( "observers run in attachment order with the same raw value", async () => {
	const vs = [];
	const vx = [];
	const aReport = { r : 0.5 };

	const task = new Task(( fOk, fErr, fReport ) => {
		fReport( aReport );
		fOk();
	});

	const taskChained = task
		.progress(( x ) => {
			vs.push( "first" );
			vx.push( x );
		})
		.progress(( x ) => {
			vs.push( "second" );
			vx.push( x );
		});

	expect( taskChained ).toBe( task );

	await task;
	await fpDelay( 5 );

	expect( vs ).toEqual([ "first", "second" ]);
	expect( vx[ 0 ]).toBe( aReport );
	expect( vx[ 1 ]).toBe( aReport );
});

test( "observer return values do not transform reports", async () => {
	const vx = [];

	const task = new Task(( fOk, fErr, fReport ) => {
		fReport( 1 );
		fOk();
	});

	task
		.progress(( x ) => x * 1000 )
		.progress(( x ) => vx.push( x ));

	await task;
	await fpDelay( 5 );

	expect( vx ).toEqual([ 1 ]);
});

test( "delivery is never synchronous", () => {
	let bDelivered = false;

	const task = new Task(( fOk, fErr, fReport ) => {
		fReport( 1 );
		fOk();
	});

	task.progress(() => {
		bDelivered = true;
	});

	expect( bDelivered ).toBe( false );
	return task.then(() => expect( bDelivered ).toBe( true ));
});

test( "same-tick attachment receives a synchronous report", async () => {
	const vx = [];

	const task = new Task(( fOk, fErr, fReport ) => {
		fReport( "early" );
		setTimeout( fOk, 5 );
	});

	task.progress(( x ) => vx.push( x ));

	await task;

	expect( vx ).toEqual([ "early" ]);
});

test( "later-tick attachment misses earlier reports", async () => {
	const vx = [];

	const task = new Task(( fOk, fErr, fReport ) => {
		fReport( "early" );
		setTimeout(() => {
			fReport( "late" );
			fOk();
		}, 10 );
	});

	await fpDelay( 0 );
	task.progress(( x ) => vx.push( x ));

	await task;
	await fpDelay( 5 );

	expect( vx ).toEqual([ "late" ]);
});

test( "reports issued after the settling call are dropped", async () => {
	const vx = [];

	const task = new Task(( fOk, fErr, fReport ) => {
		fReport( "before" );
		fOk( "value" );
		fReport( "after" );
	});

	task.progress(( x ) => vx.push( x ));

	await task;
	await fpDelay( 5 );

	expect( vx ).toEqual([ "before" ]);
});

test( "reports continue after fResolve with a pending promise", async () => {
	const vx = [];
	let fOkInner;
	const pInner = new Promise(( fOk ) => {
		fOkInner = fOk;
	});

	let fReportT;
	const task = new Task(( fOk, fErr, fReport ) => {
		fReportT = fReport;
		fOk( pInner );
	});

	task.progress(( x ) => vx.push( x ));

	fReportT( "afterResolveCall" );
	await fpDelay( 5 );
	fReportT( "stillPending" );
	await fpDelay( 5 );

	fOkInner();
	await task;
	await fpDelay( 5 );
	fReportT( "afterSettle" );
	await fpDelay( 5 );

	expect( vx ).toEqual([ "afterResolveCall", "stillPending" ]);
});

test( "attachment position selects the observation window", async () => {
	const vxStageA = [];
	const vxWhole = [];

	const taskA = new Task( async ( fOk, fErr, fReport ) => {
		fReport( "a1" );
		await fpDelay( 5 );
		fReport( "a2" );
		fOk();
	});

	const ftaskB = () => new Task( async ( fOk, fErr, fReport ) => {
		fReport( "b1" );
		await fpDelay( 5 );
		fReport( "b2" );
		fOk();
	});

	const taskWhole = taskA
		.progress(( x ) => vxStageA.push( x ))
		.then( ftaskB )
		.progress(( x ) => vxWhole.push( x ));

	await taskWhole;
	await fpDelay( 10 );

	expect( vxStageA ).toEqual([ "a1", "a2" ]);
	expect( vxWhole ).toEqual([ "a1", "a2", "b1", "b2" ]);
});

test( "catch-handler-returned task reports forward", async () => {
	const vx = [];

	const task = new Task( async ( fOk, fErr ) => {
		await fpDelay( 5 );
		fErr( "bad" );
	});

	const taskRecovered = task
		.catch(() => new Task( async ( fOk, fErr, fReport ) => {
			fReport( "recovering" );
			await fpDelay( 5 );
			fOk( "recovered" );
		}))
		.progress(( x ) => vx.push( x ));

	const x = await taskRecovered;
	await fpDelay( 5 );

	expect( x ).toBe( "recovered" );
	expect( vx ).toEqual([ "recovering" ]);
});

test( "finally-derived tasks forward the parent stream", async () => {
	const vx = [];
	let bRan = false;

	const task = new Task( async ( fOk, fErr, fReport ) => {
		fReport( "step" );
		await fpDelay( 5 );
		fOk( "done" );
	});

	const taskFinal = task
		.finally(() => {
			bRan = true;
		})
		.progress(( x ) => vx.push( x ));

	const x = await taskFinal;
	await fpDelay( 5 );

	expect( x ).toBe( "done" );
	expect( bRan ).toBe( true );
	expect( vx ).toEqual([ "step" ]);
});

test( "a throwing observer does not starve later observers", async () => {
	jest.useFakeTimers({ doNotFake : [ "queueMicrotask" ]});
	const vx = [];

	try{
		const task = new Task(( fOk, fErr, fReport ) => {
			fReport( 1 );
			fOk();
		});

		task
			.progress(() => {
				throw new Error( "boom" );
			})
			.progress(( x ) => vx.push( x ));

		await task;

		expect( vx ).toEqual([ 1 ]);
		expect(() => jest.runAllTimers()).toThrow( "boom" );
	}
	finally{
		jest.useRealTimers();
	}
});

test( "then ignores a third options argument", async () => {
	const vx = [];

	const task = new Task(( fOk ) => {
		fOk( 1 );
	});

	const taskDerived = task.then(
		( x ) => x + 1,
		undefined,
		{ started : "Started", done : "Done" }
	);
	taskDerived.progress(( x ) => vx.push( x ));

	const x = await taskDerived;
	await fpDelay( 5 );

	expect( x ).toBe( 2 );
	expect( vx ).toEqual([]);
});

test( "constructor takes a single argument and emits no markers", async () => {
	const vx = [];

	const task = new Task(
		( fOk, fErr, fReport ) => {
			fReport( "only" );
			fOk( "done" );
		},
		{ started : "Started", done : "Done", error : "Error" }
	);
	task.progress(( x ) => vx.push( x ));

	await task;
	await fpDelay( 5 );

	expect( vx ).toEqual([ "only" ]);
});

test( "combinator member reports use the wrapper format", async () => {
	const vx = [];

	const taskCombined = Task.all([
		new Task( async ( fOk, fErr, fReport ) => {
			fReport( "p1" );
			await fpDelay( 5 );
			fOk( 1 );
		}),
		new Task( async ( fOk, fErr, fReport ) => {
			await fpDelay( 2 );
			fReport( "p2" );
			fOk( 2 );
		}),
		Promise.resolve( 3 ),
		4
	]);

	taskCombined.progress(( x ) => vx.push( x ));

	const vxResult = await taskCombined;
	await fpDelay( 5 );

	expect( vxResult ).toEqual([ 1, 2, 3, 4 ]);
	expect( vx ).toEqual([
		{ task : 0, report : "p1" },
		{ task : 1, report : "p2" }
	]);
});

test( "member reports after the combined task settles are dropped", async () => {
	const vx = [];

	const taskCombined = Task.race([
		new Task(( fOk ) => {
			fOk( "fast" );
		}),
		new Task( async ( fOk, fErr, fReport ) => {
			await fpDelay( 10 );
			fReport( "slow" );
			fOk( "slow" );
		})
	]);

	taskCombined.progress(( x ) => vx.push( x ));

	const x = await taskCombined;
	await fpDelay( 20 );

	expect( x ).toBe( "fast" );
	expect( vx ).toEqual([]);
});

test( "allSettled forwards member reports across rejections", async () => {
	const vx = [];

	const taskCombined = Task.allSettled([
		new Task( async ( fOk, fErr, fReport ) => {
			fReport( "p1" );
			await fpDelay( 2 );
			fErr( "reject" );
		}),
		new Task( async ( fOk, fErr, fReport ) => {
			await fpDelay( 5 );
			fReport( "p2" );
			await fpDelay( 5 );
			fOk( "success" );
		})
	]);

	taskCombined.progress(( x ) => vx.push( x ));

	const vaResult = await taskCombined;
	await fpDelay( 5 );

	expect( vaResult ).toEqual([
		{ status : "rejected", reason : "reject" },
		{ status : "fulfilled", value : "success" }
	]);
	expect( vx ).toEqual([
		{ task : 0, report : "p1" },
		{ task : 1, report : "p2" }
	]);
});
