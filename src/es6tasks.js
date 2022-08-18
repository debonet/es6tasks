// ===========================================================================
// ===========================================================================
class Task extends Promise{
/*
	aOpts = undefined;
	aState = undefined;
*/
	
	// -------------------------------------------
	constructor( f, aOpts = {}){
		const aState = { n : 0, xProgress : aOpts[ 'started' ], vfxProgress : [] };
		let fReportProgress = () => {};
		
		let self;
		
		super(( fOk, fErr ) => {
			aState.n = 1;
			if ( self ){
				self.fReportProgress( self.aOpts[ 'started' ]);
			}
			else if ( aOpts[ 'started' ] ){
				aState.xProgress = aOpts[ 'started' ];
			}
			f(
				( x ) => {
					aState.n = 2;
					if ( self ){
						self.fReportProgress( self.aOpts[ 'done' ]);
					}
					else if ( aOpts[ 'done' ] ){
						aState.xProgress = aOpts[ 'done' ];
					}
					return fOk( x );
				},
				( err ) => {
					aState.n = 3;
					if ( self ){
						self.fReportProgress( self.aOpts[ 'error' ]);
					}
					else if ( aOpts[ 'error' ] ){
						aState.xProgress = aOpts[ 'error' ];
					}
					return fErr( err );
				},
				( x ) => {
					if ( self ){
						self.fReportProgress( x );
					}
					else{
						aState.xProgress = x;
					}
					return x;
				}
			);
		});

		self = this;

		Object.defineProperty( this, 'aOpts', {
			enumerable : false,
			value : { ...aOpts }
		});

		Object.defineProperty( this, 'aState', {
			enumerable : false,
			value : aState
		});

		Object.defineProperty( this, 'fReportProgress', {
			enumerable : false,
			value :  ( xIn ) => {
				if ( xIn == undefined ){
					return;
				}
				
				this.aState.xProgress = (
					this.aState.vfxProgress.reduce(( x, f ) => {
						return x != undefined ? f( x ) : x
					}, xIn )
						?? this.aState.xProgress
				);
				return this.aState.xProgress;
			}
		});
	}
	
	// -------------------------------------------
	then( fOk, fErr = undefined, aOpts = {}){
		if ( typeof fErr == 'object' ){
			aOpts = { ...fErr, ...aOpts };
			fErr = undefined;
		}

		let vfProgress = [];
		let taskNext = undefined;

		function fSetTaskNextIfTask( xNext, bResolve ){
			if ( xNext?.progress ){
				taskNext = xNext;
			}
			// Promises don't report progress, but they'll have progress() handlers
			else if ( xNext instanceof Promise ){
				return xNext;
			}
			else{
				taskNext = Task.resolve( xNext );
			}
			Object.assign( taskNext.aOpts, aOpts );

			// accumulate progress() handlers any queued before task was instantiated
			vfProgress.forEach( f => taskNext.progress( f ));
			vfProgress = undefined;
			
			taskNext.aState.n = 1;
			taskNext.fReportProgress( aOpts[ 'started' ]);
			if ( ! ( xNext?.progress )){
				taskNext.aState.n = 2;
				taskNext.fReportProgress( aOpts[ 'done' ]);
			}
		}

		const task = super.then(
			( x ) => {
				const  xNext = (
					( fOk instanceof Function )
						? fOk( x )
						: Task.resolve( x )
				);
				fSetTaskNextIfTask( xNext, true );				
				return xNext;
			},
			( err ) => {
				const xNext = (
					( fErr instanceof Function )
						? fErr( err )
						: Task.reject( err )
				);
				fSetTaskNextIfTask( xNext, false );
				return xNext;
			}
		);

		// rewrite progress() to proxy to the then method or catch method
		Object.defineProperty(task, 'progress', {
			enumerable : false,
			value : ( f ) =>{

				this.aState.vfxProgress.push( f );
				if ( this.aState.n > 0 ){
					if ( this.aState.xProgress != undefined ){
						this.aState.xProgress = (
							f( this.aState.xProgress ) ?? this.aState.xProgress
						);
					}
				}			

				if (vfProgress){
					vfProgress.push( f );
				}
				else{
					taskNext.progress( f );
				}
				return task;
			}
		});


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
		const p = super.finally(( x ) => {
			p.aState.n = 1;
			p.fReportProgress( p.aOpts[ 'started' ]);
			return f( x );
		});

		Object.assign( p.aOpts, this.aOpts, aOpts );
		return p;
	}

	// -------------------------------------------
	progress( f ){
		this.aState.vfxProgress.push( f );
		if ( this.aState.n > 0 ){
			if ( this.aState.xProgress != undefined ){
				this.aState.xProgress = (
					f( this.aState.xProgress ) ?? this.aState.xProgress
				);
			}
		}			
		return this;
	}


	// -------------------------------------------
	// allSettled() and all() race() and any()
	// -------------------------------------------
	static allSettled( vp ){
		return Task.#fpFromVP( super.allSettled.bind(this),  vp, true, true );
	}

	// -------------------------------------------
	static all( vp ){
		return Task.#fpFromVP( super.all.bind(this), vp, true, false );
	}

	// -------------------------------------------
	static race( vp ){
		return Task.#fpFromVP( super.race.bind(this),  vp, false, false );
	}

	// -------------------------------------------
	static any( vp ){
		return Task.#fpFromVP( super.any.bind(this),  vp, false, true );
	}

	// -------------------------------------------
	static #fpFromVP( fp, vp, bContinueOnResolve, bContinueOnReject ){
		let bContinue = true;

		let vpUse = vp;

		if ( !bContinueOnResolve ){
			vpUse = vp.map( p => p.then( x => {
				bContinue = false;
				return Promise.resolve( x );
			}));
		};

		if ( !bContinueOnReject ){
			vpUse = vpUse.map( p => p.catch( x => {
				bContinue = false;
				return Promise.reject( x );
			}));
		};
		
		const pFromVP = fp( vpUse );
		
		//const vxProgress = new Array( vp.length );
		
		vp.forEach(( p, n ) => {
			if ( p instanceof Task ){
				p.progress(( x ) =>	{
					if ( bContinue ){
						//vxProgress[ n ] = x;
						//pFromVP.fReportProgress( vxProgress );
						pFromVP.fReportProgress({ task: n, report: x });
					}
				});
			}
		});


		return pFromVP;
	}
	
}

module.exports = Task;



