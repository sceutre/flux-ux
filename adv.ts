import * as React from "react";

interface Listener {
   callback: Function;
   obj: Director;
   status: number;
}

interface InProgress {
   action: Action<any>;
   args: any[];
   listeners: Listener[];
   startedId: number;
   doneId: number;
}

type Director_RO = Readonly<Director>;

export class Action<F extends Function> {
   private listeners:Listener[] = [];

   constructor(public name:string) {}

   add(dir: Director, callback: F):void {
      this.listeners.push({ callback: callback, obj: dir, status: 0});
   }

   remove(dir: Director):void {
      this.listeners = this.listeners.filter(x => x.obj != dir);
   }

   fire:F = ((...args:any[]):void => {
      dispatcher.dispatchAction(this.listeners, this, args);
   }) as any;

}

export class ExecComponent<P, S> extends React.Component<P, S> {
   directors(): Director_RO[] {
      return [];
   }

   componentDidMount(): void {
      for (let d of this.directors())
         d.addView(this);
   }

   componentWillUnmount(): void {
      for (let d of this.directors())
         d.removeView(this);
   }

   onDirectorChanged(dir: Director) {
      this.forceUpdate();
   }
}

export class Director {
   private views: ExecComponent<any,any>[] = [];

   constructor(public name: string) { }

   addView(view: ExecComponent<any, any>): void {
      if (this.views.indexOf(view) < 0) {
         this.views.push(view);
      }
   }

   removeView(obj: ExecComponent<any, any>): void {
      let ix = this.views.indexOf(obj);
      if (ix >= 0) {
         this.views.splice(ix, 1);
      }
   }

   changed(): void {
      for (let view of this.views) {
         view.onDirectorChanged(this);
      }
   }
}

class Dispatcher {
   private stage = 0;
   private inProgress: InProgress | undefined;

   dispatchAction(listeners: Listener[], action: Action<any>, args: any[]) {
      if (this.inProgress)
         throw new Error(`Trying to fire ${action.name} while another action ${this.inProgress.action.name} is firing.  Actions begetting actions is not allowed as it makes behavior very complex.`);
      this.inProgress = {
         action: action,
         args: args,
         listeners: listeners,
         startedId: this.stage + 1,
         doneId: this.stage + 2
      };
      this.stage = this.inProgress.doneId;
      try {
         this.dispatchLoop(this.inProgress);
      } finally {
         this.inProgress = undefined;
      }
   }

   waitFor(directors: Director[]) {
      if (this.inProgress)
         this.dispatchLoop(this.inProgress, directors);
   }

   private dispatchLoop(inProgress: InProgress, onlyDirectors?: Director[]) {
      for (let i = 0, n = inProgress.listeners.length; i < n; i++) {
         let listener = inProgress.listeners[i];
         if (onlyDirectors) {
            if (onlyDirectors.indexOf(listener.obj) < 0)
               continue;
            if (listener.status == inProgress.startedId)
               throw new Error(`Detected a waitFor cycle with ${listener.obj.name}`);
         }
         if (listener.status < inProgress.startedId) {
            listener.status = inProgress.startedId;
            listener.callback.apply(listener.obj, inProgress.args);
            listener.status = inProgress.doneId;
         }
      }

   }
}

let dispatcher: Dispatcher = new Dispatcher();

export const waitFor = (...directors: Director[]) => dispatcher.waitFor(directors);
