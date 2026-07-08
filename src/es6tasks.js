// ===========================================================================
// ===========================================================================
class Task extends Promise{
	#vfProgress = [];
	#bSettled = false;

	// -------------------------------------------
	static get [ Symbol.species ](){
		return Promise;
	}

	// -------------------------------------------
	constructor( fxExecutor ){
		let fResolveT;
		let fRejectT;

		super(( fResolve, fReject ) => {
			fResolveT = fResolve;
			fRejectT = fReject;
		});

		const fSettle = () => {
			this.#bSettled = true;
		};
		Promise.prototype.then.call( this, fSettle, fSettle );

		try{
			fxExecutor( fResolveT, fRejectT, ( x ) => this.#fEmit( x ));
		}
		catch( xErr ){
			fRejectT( xErr );
		}
	}

	// -------------------------------------------
	#fEmit( x ){
		queueMicrotask(() => this.#fDeliver( x ));
	}

	// -------------------------------------------
	#fDeliver( x ){
		if ( this.#bSettled ){
			return;
		}
		for ( const f of this.#vfProgress ){
			this.#fInvoke( f, x );
		}
	}

	// -------------------------------------------
	#fInvoke( f, x ){
		try{
			f( x );
		}
		catch( xErr ){
			setTimeout(() => {
				throw xErr;
			}, 0 );
		}
	}

	// -------------------------------------------
	progress( f ){
		this.#vfProgress.push( f );
		return this;
	}

	// -------------------------------------------
	then( fOk, fErr ){
		let task;
		const p = super.then(
			typeof fOk == "function"
				? ( x ) => this.#fxChained( task, fOk, x )
				: undefined,
			typeof fErr == "function"
				? ( x ) => this.#fxChained( task, fErr, x )
				: undefined
		);
		task = new Task(( fResolve, fReject ) => {
			p.then( fResolve, fReject );
		});
		this.progress(( x ) => task.#fEmit( x ));
		return task;
	}

	// -------------------------------------------
	#fxChained( task, f, x ){
		const xOut = f( x );
		if ( typeof xOut?.progress == "function" ){
			xOut.progress(( xReport ) => task.#fEmit( xReport ));
		}
		return xOut;
	}

	// -------------------------------------------
	catch( fErr ){
		return this.then( undefined, fErr );
	}

	// -------------------------------------------
	// allSettled() and all() race() and any()
	// -------------------------------------------
	static allSettled( vp ){
		return Task.#ftaskForwarded( super.allSettled( vp ), vp );
	}

	// -------------------------------------------
	static all( vp ){
		return Task.#ftaskForwarded( super.all( vp ), vp );
	}

	// -------------------------------------------
	static race( vp ){
		return Task.#ftaskForwarded( super.race( vp ), vp );
	}

	// -------------------------------------------
	static any( vp ){
		return Task.#ftaskForwarded( super.any( vp ), vp );
	}

	// -------------------------------------------
	static #ftaskForwarded( task, vp ){
		vp.forEach(( p, n ) => {
			if ( p instanceof Task ){
				p.progress(( x ) => task.#fEmit({ task : n, report : x }));
			}
		});
		return task;
	}

	// -------------------------------------------
	// -------------------------------------------
	static async( fp ){
		if ( typeof fp != "function" ){
			throw new Error( "Task.async requires a promise-returning function" );
		}
		return ( ...vx ) => new Task(
			( fResolve, fReject, fReport ) => {
				fp( fReport, ...vx ).then( fResolve, fReject );
			}
		);
	}

	// -------------------------------------------
	// -------------------------------------------
	static taskify( x ){
		if ( x instanceof Task ){
			return x;
		}
		if ( x instanceof Promise ){
			return new Task(( fResolve, fReject ) => {
				x.then( fResolve, fReject );
			});
		}
		return Task.resolve( x );
	}
}


module.exports = Task;
