// ===========================================================================
// ===========================================================================
class Task extends Promise{
/*
	aState = undefined;
*/
	
	// -------------------------------------------
	constructor( f, aOpts = {}){

		const aState = {
			n : 0, vxProgress : [], vfxProgress : []
		};
		
		let self;

		const fReportOrStore = function( x ){
			if ( self ){
				self.fReportProgress( x );
			}
			else if ( x !== undefined ){
				aState.vxProgress.push( x );
			}
		}

		
		super(( fOk, fErr ) => {
			aState.n = 1;
			fReportOrStore( aOpts[ 'started' ]);

			// call the function
			f(
				( x ) => {
					aState.n = 2;
					fReportOrStore( aOpts[ 'done' ]);
					return fOk( x );
				},
				( err ) => {
					aState.n = 3;
					fReportOrStore( aOpts[ 'error' ]);
					return fErr( err );
				},
				( x ) => {
					fReportOrStore( x );
					return x;
				}
			);
		});

		self = this;

		Object.defineProperty( this, 'aState', {
			enumerable : false,
			value : aState
		});

		Object.defineProperty( this, 'fReportProgress', {
			enumerable : false,
			value :  ( xIn ) => {
				if ( xIn === undefined ){
					return;
				}

				let x = this.aState.vfxProgress.reduce(
					( x, f ) => ( x !== undefined ) ? f( x ) : x,
					xIn
				);

				if (this.aState.vfxProgress.length == 0 ){
					this.aState.vxProgress.push( x );
				}
				else{
					this.aState.vxProgress = [];
				}
			}
		});
	}
	

	// -------------------------------------------
	#fChain( task, aOpts, x, f, fTaskify ){
		task.fReportProgress( aOpts[ 'started' ]);

		let xOut = f( x );
		if ( xOut?.progress ){
			xOut.progress( x => {
				task.fReportProgress( x );
				return x;
			});
		}

		if ( xOut instanceof Task ){
			const xOutOrig = xOut;
			xOut = xOutOrig.then(
				x=> { xOutOrig.fReportProgress( aOpts[ 'done' ]); return x },
				x=> { xOutOrig.fReportProgress( aOpts[ 'error' ]); return Promise.reject( x ); }
			);
		}
		else{
			task.fReportProgress( aOpts[ 'done' ]);
		}
		return xOut;
	}
	
	// -------------------------------------------
	then( fOk, fErr = undefined, aOpts = {}){
		if ( typeof fErr == 'object' ){
			aOpts = { ...fErr, ...aOpts };
			fErr = undefined;
		}
		
		const task = super.then(
			fOk	 ? x => this.#fChain( task, aOpts, x, fOk ) : undefined,
			fErr ? x => this.#fChain( task, aOpts, x, fErr, Promise.reject ) : undefined,
		);

		this.progress( x => {
			task.fReportProgress( x );
			return x;
		});

		return task;
	}

	
	// -------------------------------------------
	catch( fErr, aOpts = {} ){
		return this.then( undefined, fErr, aOpts);
	}

	// -------------------------------------------
	finally( f, aOpts = {}){
		const task = super.finally(	x => this.#fChain( task, aOpts, x, f ));
		this.progress( x => {
			task.fReportProgress( x );
			return x;
		});
		return task;
	}

	// -------------------------------------------
	progress( f ){
		this.aState.vfxProgress.push( f );
		this.aState.vxProgress = this.aState.vxProgress.map(
			x => x !== undefined ? f( x ) : x
		);
		return this;
	}


	// -------------------------------------------
	// allSettled() and all() race() and any()
	// -------------------------------------------
	static allSettled( vp, aOpts = {}){
		return Task.#fpFromVP(
			super.allSettled.bind(this),  vp, true, true, aOpts
		);
	}

	// -------------------------------------------
	static all( vp, aOpts = {}){
		return Task.#fpFromVP(
			super.all.bind(this), vp, true, false, aOpts
		);
	}

	// -------------------------------------------
	static race( vp, aOpts = {}){
		return Task.#fpFromVP(
			super.race.bind(this),  vp, false, false, aOpts
		);
	}

	// -------------------------------------------
	static any( vp, aOpts = {}){
		return Task.#fpFromVP(
			super.any.bind(this),  vp, false, true, aOpts
		);
	}

	// -------------------------------------------
	static #fpFromVP(
		fp, vp, bContinueOnResolve, bContinueOnReject, aOpts
	){
		let bContinue = true;

		let vpUse = vp;

		if ( !bContinueOnResolve ){
			vpUse = vp.map( p => p.then( x => {
				bContinue = false;
				return Promise.resolve( x );
			}));
		};

		if ( !bContinueOnReject ){
			vpUse = vpUse.map( p => {
				return ( p instanceof Promise)
					?	p.catch( x => {
						bContinue = false;
						return Promise.reject( x );
					})
					: p
			});
		};
		
		const pFromVP = fp( vpUse )

		if ( aOpts[ 'started' ] ){
			pFromVP.fReportProgress({ task : 'all', report : aOpts[ 'started' ]});
		}
		
		vp.forEach(( p, n ) => {
			if ( p instanceof Task ){
				p.progress(( x ) =>	{
					if ( bContinue ){
						pFromVP.fReportProgress({ task : n, report : x });
					}
				});
			}
		});

		return pFromVP
			.then( x => {
				if ( aOpts[ 'done' ] ){
					pFromVP.fReportProgress({ task : 'all', report : aOpts[ 'done' ]});
				}
				return x;
			})
			.catch( x => {
				if ( aOpts[ 'error' ] ){
					pFromVP.fReportProgress({ task : 'all', report : aOpts[ 'error' ]});
				}
				return Task.reject( x );
			})

	}



	// -------------------------------------------
	// -------------------------------------------
	static async( fp, aOpts = {}){
		if ( typeof fp != "function" ){
			throw (
				new Error("Task.async requires an promise-returning function")
			);
		}
		
		return ( ...vx ) => {
			const aState = {
				n : 1, vxProgress : [ aOpts[ 'started' ]], vfxProgress : []
			}
			
			const fReportProgress = ( xIn ) => {
				let x = aState.vfxProgress.reduce(
					( x, f ) => ( x !== undefined ) ? f( x ) : x,
					xIn
				);

				if (aState.vfxProgress.length == 0 ){
					aState.vxProgress.push( x );
				}
				else{
					aState.vxProgress = [];
				}
			}

			const p =	(
				fp( fReportProgress, ...vx )
					.then( x => { fReportProgress( aOpts[ 'done' ]); return x; })
					.catch( x => { fReportProgress( aOpts[ 'error' ]); return x; })
			);
			
			p.__proto__ = Task.prototype;
			Object.defineProperty( p, "aState", { value: aState });
			return p;
		}
	}

	// -------------------------------------------
	// -------------------------------------------
	static taskify( x ){
		if ( x instanceof Task ){
			return x;
		}
		else if ( x instanceof Promise ){
			const p = x;
			p.__proto__ = Task.prototype;
			Object.defineProperty( p, "aState", { value: aState });
			return p;
		}
		else {
			return Task.resolve( x );
		}
	}
}

	
module.exports = Task;



