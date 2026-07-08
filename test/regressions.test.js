const Task = require( "../src/es6tasks.js" );

function fpDelay( dtm ){
	return new Promise(( fOk ) => setTimeout( fOk, dtm ));
}

test( "Task.async wraps an async function into a real Task", async () => {
	const vx = [];

	const ftaskWork = Task.async( async ( fReport, zA, zB ) => {
		fReport( "start" );
		await fpDelay( 5 );
		fReport( "mid" );
		return zA + zB;
	});

	const task = ftaskWork( 2, 3 );
	expect( task instanceof Task ).toBe( true );

	task.progress(( x ) => vx.push( x ));

	const z = await task.then(( x ) => x );
	await fpDelay( 5 );

	expect( z ).toBe( 5 );
	expect( vx ).toEqual([ "start", "mid" ]);
});

test( "Task.async rejections propagate", async () => {
	const ftaskFail = Task.async( async () => {
		await fpDelay( 2 );
		throw new Error( "nope" );
	});

	await expect( ftaskFail()).rejects.toThrow( "nope" );
});

test( "Task.async requires a function", () => {
	expect(() => Task.async( 5 )).toThrow(
		"Task.async requires a promise-returning function"
	);
});

test( "taskify adopts a plain promise's fulfillment", async () => {
	const task = Task.taskify( fpDelay( 2 ).then(() => 7 ));

	expect( task instanceof Task ).toBe( true );
	expect( await task ).toBe( 7 );
});

test( "taskify adopts a plain promise's rejection", async () => {
	const task = Task.taskify(
		fpDelay( 2 ).then(() => {
			throw new Error( "bad" );
		})
	);

	expect( task instanceof Task ).toBe( true );
	await expect( task ).rejects.toThrow( "bad" );
});

test( "taskify returns a Task argument unchanged", () => {
	const task = new Task(( fOk ) => fOk());

	expect( Task.taskify( task )).toBe( task );
});

test( "taskify resolves a raw value", async () => {
	const task = Task.taskify( 9 );

	expect( task instanceof Task ).toBe( true );
	expect( await task ).toBe( 9 );
});

test( "taskified task supports progress with no reports", async () => {
	const vx = [];

	const task = Task.taskify( fpDelay( 2 ).then(() => "ok" ));
	expect( task.progress(( x ) => vx.push( x ))).toBe( task );

	expect( await task ).toBe( "ok" );
	await fpDelay( 5 );

	expect( vx ).toEqual([]);
});
