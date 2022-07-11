// ===========================================================================
// ===========================================================================
class Task extends Promise{
	#aOpts = undefined;
	#aState = undefined;

	// -------------------------------------------
	constructor( f, aOpts = {}){
		const aState = { n : 0, xProgress : aOpts[ 'started' ], vfxProgress : [] };
		let fReportProgress = () => {};
		
		let self;
		
		super(( fOk, fErr ) => {
			aState.n = 1;
			if ( self ){
				self.#fReportProgress( self.#aOpts[ 'started' ]);
			}
			else if ( aOpts[ 'started' ] ){
				aState.xProgress = aOpts[ 'started' ];
			}
			f(
				( x ) => {
					aState.n = 2;
					if ( self ){
						self.#fReportProgress( self.#aOpts[ 'done' ]);
					}
					else if ( aOpts[ 'done' ] ){
						aState.xProgress = aOpts[ 'done' ];
					}
					return fOk( x );
				},
				( err ) => {
					aState.n = 3;
					if ( self ){
						self.#fReportProgress( self.#aOpts[ 'error' ]);
					}
					else if ( aOpts[ 'error' ] ){
						aState.xProgress = aOpts[ 'error' ];
					}
					return fErr( err );
				},
				( x ) => {
					if ( self ){
						self.#fReportProgress( x );
					}
					else{
						aState.xProgress = x;
					}
					return x;
				}
			);
		});

		self = this;
		
		this.#aOpts = { ...aOpts };
		this.#aState = aState;
	};

	// -------------------------------------------
	#fReportProgress = ( xIn ) => {
		if ( xIn == undefined ){
			return;
		}
		
		this.#aState.xProgress = (
			this.#aState.vfxProgress.reduce(( x, f ) => f( x ), xIn )
				?? this.#aState.xProgress
		);
		return this.#aState.xProgress;
	}
	
	// -------------------------------------------
	then( fOk, fErr = undefined, aOpts = {}){
		if ( typeof fErr == 'object' ){
			aOpts = { ...fErr, ...aOpts };
			fErr = undefined;
		}

		let vfProgress = [];
		let taskNext = undefined;

		function fSetTaskNextIfTask( xNext, nState, xReport ){
			if ( xNext instanceof Task ){
				taskNext = xNext;
			}
			else{
				taskNext = Task.resolve(xNext);
			}
			taskNext.#aOpts = {...taskNext.#aOpts, ...aOpts}

			// accumulate progress() handlers any queued before task was instantiated
			vfProgress.forEach((f)=>taskNext.progress(f));
			vfProgress = undefined;
			
			taskNext.#aState.n = 1;
			taskNext.#fReportProgress( aOpts[ 'started' ]);
			if ( ! ( xNext instanceof Task )){
				taskNext.#aState.n = 2;
				taskNext.#fReportProgress( aOpts[ 'done' ]);
			}
		}
		
		const task = super.then(
			( x ) => {
				const  xNext = ( fOk instanceof Function ) ? fOk( x ) : fOk;
				fSetTaskNextIfTask( xNext );
				return xNext;
			},
			( err ) => {
				const xNext = ( fErr instanceof Function ) ? fErr( err ) : Task.reject( err );
				fSetTaskNextIfTask( xNext );
				return xNext;
			}
		);

		// rewrite progress() to proxy to the then method or catch method
		task.progress = ( f ) =>{
			if (vfProgress){
				vfProgress.push( f );
			}
			else{
				taskNext.progress( f );
			}
			return task;
		}

		return task;
	}

	// -------------------------------------------
	catch( ...vx ){
		return this.then(( x ) => x, ...vx );
	}

	// -------------------------------------------
	finally( f, aOpts = {}){
		const p = super.finally(( x ) => {
			p.#aState.n = 1;
			p.#fReportProgress( p.#aOpts[ 'started' ]);
			return f( x );
		});

		p.#aOpts = { ...this.#aOpts, ...aOpts };
		return p;
	}

	// -------------------------------------------
	progress( f ){
		this.#aState.vfxProgress.push( f );
		if ( this.#aState.n > 0 ){
			if ( this.#aState.xProgress != undefined ){
				this.#aState.xProgress = f( this.#aState.xProgress ) ?? this.#aState.xProgress;
			}
		}			
		return this;
	}


	// -------------------------------------------
	// allSettled() and all() 
	// -------------------------------------------
	static allSettled( vp ){
		return Task.#fpFromVP( super.allSettled.bind(this),  vp, true );
	}

	// -------------------------------------------
	static all( vp ){
		return Task.#fpFromVP( super.all.bind(this), vp, false );
	}

	// -------------------------------------------
	static #fpFromVP( fp, vp, bContinueReport ){
		let n = 0;
		
		const pFromVP = fp(
			vp.map(( p ) => {
				if ( !( p instanceof Promise )){
					return p;
				}

				return p.then(
					( x ) => {
						if ( n >= 0 ){
							n++;
							pFromVP.#fReportProgress( n );
						}
						return x;
					},
					( x ) => {
						if ( n >= 0 ){
							n++;
							pFromVP.#fReportProgress( n );
							if ( !bContinueReport ){
								n = -1;
							}
						}
						return Task.reject( x );
					}
				)
			})
		);

		return pFromVP;
	}
	
}

module.exports = Task;



