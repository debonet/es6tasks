# es6tasks

ES6 Promises with support for progress updates

# Usage

Tasks are just like Promises, but they have an added `.progress()` method which is triggered during the execution of the task.

The use of a task might look like this:

```javascript

	taskReturningFunction( 10 )
		.progress(( x ) => console.log(`on step ${x}`))
		.then( ... )
		.catch( ... )
		.finally( ... )
```

New Task creation is very similar to a Promise, but its function takes 3 arguments. The functions 3rd argument is a function that is called to report progress.

e.g.:

```javascript

	new Task(( resolve, reject, report) => {
		report( 1 );
		...
		report( 2 );
		...
		report( 3 );
		...
		resolve( "success" );
	})
```


`.progress()` handlers are chained, similarly to `then()` handlers, as in this example:


```javascript
	taskReturningFunction( 10 )
		.progress(( x ) => Math.floor( x * 100 ))
		.progress(( x ) => console.log(`progress ${ x }%` ))
```



The reported progress values can be of any type, and special progress values can be issued on starting, done, and errors using a options argument to `new Task( f, options )`, e.g.:

```javascript
	new Task(
		async ( resolve, reject, report) => {
			setTimeout(()=>{
				report( "step 1" );
				report( "step 2" );
				report( "step 3" );
				resolve( "success" );
			}, 100);
		}, {
			started : "getting going!",
			done : "finished successfully",
			error : "Failed",
		}
	)
	.progress(console.log)
	.then(console.log)
```
> getting going!  
> step 1  
> step 2  
> step 3  
> finished successfully  
> success  


# Putting it all together

Here's an example to combine all aspects


```javascript

	const Task = require( "@debonet/es6task" );

	function taskReturningFunction( steps, delay ){
		return new Task(( resolve, reject, report) => {
			let n = 0; 
			
			const interval = setInterval(() => {
			
				// report progress
				report( n / steps);
				n++;
				
				// do something useful
				
				if ( n >= steps ){
					cancelInterval( interval );
					resolve( "success!" );
				}
			}, delay );
		});
	}


	taskReturningFunction( 5, 100 )
		.progress(( x ) => Math.floor( x * 100 ))
		.progress(( x ) => console.log( `progress ${x}%` ))
		.then(( x ) => console.log( `the result was ${x}` ))
		.catch( ... )
		.finally(() => console.log( "all done" ))
```

output

> progress 0%  
> progress 20%  
> progress 40%  
> progress 60%  
> progress 80%  
> progress 100%  
> the result was success  
> all done  


# Syncronous tasks

Progress reporting on tasks that are synchronous (i.e. resolve immediately or return a value) will only report the optional `'done'` progress value. In the case of a `.progress()` attached to a synchronous `then()` function, the optional `'started'` progress value will also be reported.


# A small gotcha

Note that the output of a `.then()` call is a new Task, whose promise chain is attached to the task returned by the `.then()` statement.

```javascript
	taskReturningFunction( 10 )
		.progress(( x ) => console.log( `progress1:  ${x}` ))
		.then( someOtherTask )
		.progress(( x ) => console.log( `progress2:  ${x}` ))
```


# API

## new Task()
* `new Task( func, options = {} )`

Creates a new Task object

_**func**_
> a function of the form `func( resolve, reject, report )` where `resolve` and `reject` act as they do for Promises, and `report` is passed to the Tasks promise chain

_**options**_
> an optional options object with 3 optional fields:
> ```javascript
>	{
>		started : 
>		done : 
>		error : 
>	}
> ```
> which specify values that are passed to the promise change at the start of the task, when it is completed, or when it is rejected. 


## progress
* `Task.prototype.progress( func )`

adds a new progress handler

_**func**_
> a function that receives the current value of the progress chain, or the value that was reported by the task if this is the first handler in the chain.

_**returns**_
> the task


## then
* `Task.prototype.then( resolve, options )`
* `Task.prototype.then( resolve, reject, options )`

adds a new then and/or catch handler

_**resolve**_
> a function called when the task is resolved

_**reject**_
> a function called when the task is rejeced

_**options**_
> an optional options object with 3 optional fields:
> ```javascript
>		{
>			started : 
>			done : 
>			error : 
>		}
> ```
> which specify options applied to the promise chain for _both_ the resolve and reject outcomes of the  Task.

_**returns**_
> a new task that begins when the prior task settles

## catch
* `Task.prototype.then( reject, options )`

shorthad for `Task.prototype( undefined, reject, options`

## finally
* `Task.prototype.finally( final )`

Identical to the `Promises.finally()` behavior.


# Static methods

## all, allsettled, race, any
* `Task.all( taskArray )`
* `Task.allSettled( taskArray )`
* `Task.race( taskArray )`
* `Task.any( taskArray )`

_**taskArray**_
> an array of Tasks, Promises, or non-promise-derived values

Operates with the usual `Promise.*()` behavior, with the addition that
the progress reports of each task in the provided taskArray are
concatenated into an array and returned as progress for each update. Progress updates stop after the 

## Others
* `Task.resolve( value )`
* `Task.reject( reason )`

Identical to the equivalent `Promises.*()` behavior.


# installation

```javascript
	npm install @debonet/es6tasks
```
