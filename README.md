# flux-ux

This is an implementation of a flux-like system for react, aimed
at projects that are typescript-only.

If you're unfamilar with flux take a moment and read 
[Facebook's description](http://facebook.github.io/flux/).
Flux began more as an idea than a set of libraries, and
although FB has since released a bunch of flux related code
it is still more a philopsophy than codebase.

There are many implementations of flux, however none were 
leveraging typescript as well as I felt they could be.  

Additionally I had issues with the name Store.  I mean, it's a fine
name and I think if you think about it hard enough it makes perfect
sense.  What I felt made even *more* sense though was to call them
UX.  The classes really are in charge of the user experience and in
my mind storing state is a less interesting part of what they do.  It
seems to read better in my code too todoStore vs uxTodo.  They both
do the same thing, but the second to me seems to scream that it is 
responsible for coordinating the entire "Todo" part of my app while the
first seems like a wrapper on a map or database or something.


## the diagram

Here's an architecture diagram which is pretty much the same as Facebooks,
however it hilights what to me are the more interesting parts of the pattern,
the various tight versus loose couplings, and sync vs async calls.

![architecture diagram](https://sceutre.github.io/flux-ux/diagram.svg)

## the things in the diagram

<u>**Action**</u>
- An Action represents a multicast function type safe through typescript--these 
  are basically [signals](https://github.com/robertpenner/as3-signals)
- It's best practice to only pass around javascript objects, arrays, 
  and values as arguments to an action.  Eg not classes.  That makes it easier to
  log and replay actions (although that's not implemented yet for flux-ux). 
- There will be a lot of actions, but they are easy to make.  Unfortunately, 
  in order to not have dependency cycles amoung modules, actions typically 
  have to be defined in thier own module

<u>**Component**</u>
- These are exactly react components
- They should contains no business logic, nor asynchronous calls
- The can have state, but it can only be "ui state"

<u>**ExecComponent**</u>
- These are special components that read from UXs and listen for changes (which by default forceUpdates them).

<u>**UX**</u>
- These are responsible for business logic and state storage in the app (eg a rename of Store)
- It is always a singleton.  This has implications for how many UXs there are.  In general there should be
  a UX per major "area" in the program, not a UX per component.
- It is exported as read-only.  Thus the only way changes are made are in response to Actions.
- There are no asynchronous calls--when we desire an async call these go through a bridge

<u>**Bridge**</u>
- These are responsible for talking to servers, doing rpc's and receive push communications
- It is also a singleton.
- Unlike UXs, bridges expose to public state to be read.  They internally may be quite complex
  (eg retrying failed calls, maintaining a connection pool) but keep that all in house.
- Bridges expose behvaior to be invoked by UXs, ie it's a service provider for UX.
- Invocations do not include callbacks.  Instead, the bridge fire an action if it wishes to 
  inform the rest of the app about the result of a server operation.

<u>**Dispatcher**</u>
- Singleton central dispatcher used by Actions
- Can wait for other UXs to be finsihed processing Action (with cycle protection)

## discussion

It may seem there's a lot of ceremony around UI to UX communication.  And indeed it takes up a lot of
space on the graph, but I don't believe in practice it is too burdensome.  You can't avoid managing state
when building with react and while there are lots of ways to do so none are going to be too much simpler
than this in a large application.

What's more troubling is the async model using UX and Bridge.  The UX as a singleton is technically a fine
place to be doing async calls, and given async/await and a nice code-generated infrastructure these methods
do not have to be long.  However, allowing UXs to make async calls means that their methods would be more
complex to understand (which seemed to be Facebook's initial rationale for disallowing) and that the current
state of the UI would not longer be derivable solely from the sequence of Actions (which seems other flux
architectures main reason for disallowing).

Balanced against those gains is the increased ceromony.  In our chatbox app we have around 1000 server rpcs
calls in our codebase, and about 30 or so push call sites.  The push is fine as actions (and indeed that's
basically what we're doing) but the 1000 rpc calls means naively 1000 actions to communicate the results.  

Hopefully we'd abe able to hide some of those calls inside the Bridge as a higher order invocation. We could
also have a generic rpcFinished(requestId, data) action although that seems like a modelling fail.  More
experience with large code bases is required.


## example

```
// in actions.ts

// it's unfortunate, but actions are grouped in a separate file to avoid module dependency cycles

import {Action} from "flux-ux";

export const loginSubmittedAction = new Action<(username:string, password:string) => void>("Login Submitted");
export const loginDoneAction = new Action<(succeeded:boolean, error:string) => void>("Login Done");


// in LoginForm.tsx

import "*" as React from "react";
import {ExecComponent} from "flux-ux";
import {loginSubmittedAction} from "./actions";
import {uxLogin} from "./UxLogin";

interface MyProps { /* ... */ }

export class LoginForm extends ExecComponent<MyProps> {
   // ...

   constructor(props) {
      super(props, uxLogin);
   }

   onLoginSubmit = () => loginSubmittedAction.fire(this.username, this.password);

   render() {
      if (uxLogin.inProgress) return <Spinner />;
      // ...
   }
}
          

// in UxLogin.ts

import {loginSubmittedAction, loginDoneAction} from "./actions";
import {login} from "./loginBridge";
import {UX} from "flux-ux";

class UxLogin extends UX {
   inProgress = false;

   constructor() {
      loginSubmittedAction.add(this, this.onLoginSubmitted);
      loginDoneAction.add(this, this.onLoginDone);
      // ...
   }

   onLoginSubmitted(username:string, password:string) {
      this.inProgress = true;
      login(username, password);
      this.changed();
   }

   onLoginDone(succeeded:boolean, error:string) {
      this.inProgress = false;
      // ...
      this.changed();
   }
}
export const uxLogin = new UxLogin() as Readonly<UxLogin>;


// in loginBridge.ts

import {loginDoneAction} from "./actions";
import {server} from "./server";

// although we could implement this as a singleton class, it could also be
// a module since it's not passed around and has no inherited behavior

export function login(username:string, password:string) {
   if (!server.connected()) {
      server.connect().then(() => login(username, password));
   } else {
      server.submitLogin(username, password).then(resp => {
         loginDoneAction.fire(resp.succeeded, resp.error);
      });
   }
}

```
