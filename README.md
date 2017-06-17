# adv

Action-Director-View, a typescript take on [flux](http://facebook.github.io/flux/).

There are many implementations of flux, however none were leveraging typescript as well 
as I wanted.  Basically if we assume all code in the project is written in typescript, 
and well annotated, then I felt we should be able to provide a nicer dispatch experience.

Additionally I just can't help but think of a "store" as a place you buy something.  So
I took a shot at a different names for the core concepts.

## the diagram

![architecture diagram](https://sceutre.github.io/adv/diagram.svg)

## the things in the diagram

<u>**Action**</u>
    - an Action represents a multicast function of any types, type safe through typescript
    - these are basically [signals](https://github.com/robertpenner/as3-signals)
    - there will be a lot of actions, but they are easy to make

<u>**Component**</u>
    - these are exactly react components
    - no business logic, no asynchronous calls
    - the only state is "ui state"

<u>**ExecComponent**</u>
    - are forceUpdated when one of their Directors-of-interest changes

<u>**Director**</u>
    - responsible for business logic
    - basically a rename of Store
    - is a singleton
    - is read-only, only way changes are made are in callbacks of Actions-of-interest
    - no asynchronous calls -- go through a backend instead

<u>**Backends**</u>
    - is a singleton
    - asynchronously talks to servers doing rpc and push
    - is invoked by Director, ie a backend is a service provider for director
    - server responses do not get directly delivered anywhere (eg no callbacks).  Instead all server -> comms are consumed with backend or cause an Action to be fired

<u>**Dispatcher**</u>
    - singleton central dispatcher used by Actions
    - can wait for other Directors to be finsihed processing Action (with cycle protection)

## example

```
// in login-actions.ts

import {Action} from "adv";

export const loginSubmittedAction 
   = new Action<(username:string, password:string) => void>("Login Submitted");
export const loginDoneAction 
   = new Action<(succeeded:boolean, error:string) => void>("Login Done");


// in LoginForm.tsx

import "*" as React from "react";
import {ExecComponent} from "adv";
import {loginSubmittedAction} from "../../actions/login";
import {loginDirector} from "../../directors/login";

interface MyProps { /* ... */ }

export class LoginForm extends ExecComponent<MyProps, {}> {
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
import {login} from "./loginBackend";
import {Director} from "adv";

class LoginDirector extends Director {
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
export const loginDirector = new LoginDirector() as Readonly<LoginDirector>;


// in loginBackend.ts

import {loginDoneAction} from "../../actions/login";
import {server} from "../../server";

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
