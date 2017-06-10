# adv

Action-Director-View, a typescript take on [flux](http://facebook.github.io/flux/).

There are many implementations of flux, however none were leveraging typescript as well 
as I wanted.  Basically if we assume all code in the project is written in typescript, 
and well annotated, then I felt we should be able to provide a nicer dispatch experience.

Additionally I just can't help but think of a "store" as a place you buy something.  So
I took a shot at a different names for the core concepts.

## the diagram

![architecture diagram](https://sceutre.github.io/adv/diagram.svg)

One small point to mention is that dotted line represent loose coupling.

## the things in the diagram

<u>**Action**</u>
    - these are basically [signals](https://github.com/robertpenner/as3-signals)
    - an Action represents a multicast function, type safe through typescript
    - Views and BackendDirectors can fire actions
    - Directors can listen to actions
    - there will be a lot of actions, but they are easy to make

<u>**View**</u>
    - react components
    - no business logic
    - no asynchronous calls
    - the only state is "ui state"
    - can fire Actions

<u>**ExecutiveView**</u>
    - special type of view
    - can read from FrontendDirectors

<u>**Director**</u>
    - responsible for business logic
    - has public getters, no setters
    - singleton
    - listens to Actions
    - abstract class

<u>**FrontendDirector**</u>
    - no asynchronous calls
    - is listened to for changes by ExecutiveViews
    - is read by ExecutiveViews and other Directors

<u>**BackendDirector**</u>
    - asynchronously talks to servers doing rpc and push
    - is not listened to by anyone
    - fires Actions for server comms into the system (cannot fire Action inside of action handler)
    - is only read by other Directors

<u>**Dispatcher**</u>
    - singleton central dispatcher used by Actions
    - Directors can wait for other Directors to be finsihed processing Action (with cycle protection)

## example

(as an aside I'm a proponent of never-use-this.state, but that's not required)

```
// in login-actions.ts

import {Action} from "adv/action";

export const loginSubmittedAction 
   = new Action<(username:string, password:string) => void>("Login Submitted");
export const loginDoneAction 
   = new Action<(succeeded:boolean, error:string) => void>("Login Done");


// in LoginForm.tsx

import "*" as React from "react";
import {ExecutiveView} from "adv/views";
import {loginSubmittedAction} from "../../actions/login";
import {loginDirector} from "../../directors/login";

interface MyProps { /* ... */ }

export class LoginForm extends ExecutiveView<MyProps, {}> {

   // ...

   directors() { return [loginDirector]; }

   onLoginSubmit = () => loginSubmittedAction.fire(this.username, this.password);

   render() {
      if (loginDirector.inProgress) return <Spinner />;
      // ...
   }


}
          

// in loginDirector.ts

import {loginSubmittedAction, loginDoneAction} from "../../actions/login";
import {FrontendDirector} from "adv/directors";

export const loginDirector = new LoginDirector() as Readonly<LoginDirector>;

class LoginDirector extends FrontendDirector {
   inProgress = false;

   constructor() {
      loginSubmittedAction.add(this, this.onLoginSubmitted);
      loginDoneAction.add(this, this.onLoginDone);
      // ...
   }

   onLoginSubmitted(username:string, password:string) {
      this.inProgress = true;
      this.changed();
   }

   onLoginDone(succeeded:boolean, error:string) {
      this.inProgress = false;
      // ...
      this.changed();
   }
}


// in loginBackend.ts

import {loginSubmittedAction, loginDoneAction} from "../../actions/login";
import {server} from "../../server";
import {BackendDirector} from "adv/directors";

export const loginBackend = new LoginBackend() as Readonly<LoginBackend>;

class LoginBackend extends BackendDirector {
   constructor() {
      loginSubmittedAction.add(this, this.onLoginSubmitted);
      // ...
   }

   onLoginSubmitted(username:string, password:string) {
      server.submitLogin(username, password).then(resp => {
         loginDoneAction.fire(resp.succeeded, resp.error);
      });
   }
}
```
