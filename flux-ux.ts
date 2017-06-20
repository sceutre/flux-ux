import * as React from "react";

interface Listener {
   callback: Function;
   obj: UX;
   status: number;
}

interface InProgress {
   action: Action<any>;
   args: any[];
   listeners: Listener[];
   startedId: number;
   doneId: number;
}

type ReadonlyUX = Readonly<UX>;

export class Action<F extends Function> {
   private listeners: Listener[] = [];

   constructor(public name: string) { }

   add(dir: UX, callback: F): void {
      this.listeners.push({ callback: callback, obj: dir, status: 0 });
   }

   remove(dir: UX): void {
      this.listeners = this.listeners.filter(x => x.obj != dir);
   }

   fire: F = ((...args: any[]): void => {
      dispatcher.dispatchAction(this.listeners, this, args);
   }) as any;
}

export class ExecComponent<P={}, S={}> extends React.Component<P, S> {
   private ux: ReadonlyUX[];

   constructor(props: P, ...ux: ReadonlyUX[]) {
      super(props);
      this.ux = ux;
   }

   componentDidMount(): void {
      for (let d of this.ux)
         d.addView(this);
   }

   componentWillUnmount(): void {
      for (let d of this.ux)
         d.removeView(this);
   }

   onChangedUX(dir: UX) {
      this.forceUpdate();
   }
}

export class UX {
   private views: ExecComponent<any, any>[] = [];

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
         view.onChangedUX(this);
      }
   }

   snapshot(): any {
   }

   restore(data: any): void {
   }
}

class Dispatcher {
   private stage = 0;
   private inProgress: InProgress | undefined;

   dispatchAction(listeners: Listener[], action: Action<any>, args: any[]) {
      if (this.inProgress)
         throw new Error(`Trying to fire ${action.name} while another action ${this.inProgress.action.name} is firing.  Actions begetting actions is not allowed as it makes behavior very complex.`);
      this.onDispatched(action.name, args);
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

   waitFor(others: UX[]) {
      if (this.inProgress)
         this.dispatchLoop(this.inProgress, others);
   }

   onDispatched: (name: string, args: any[]) => void = (name, args) => {};

   private dispatchLoop(inProgress: InProgress, whitelist?: UX[]) {
      for (let i = 0, n = inProgress.listeners.length; i < n; i++) {
         let listener = inProgress.listeners[i];
         if (whitelist) {
            if (whitelist.indexOf(listener.obj) < 0)
               continue;
            if (listener.status == inProgress.startedId)
               throw new Error("Detected a waitFor cycle");
         }
         if (listener.status < inProgress.startedId) {
            listener.status = inProgress.startedId;
            listener.callback.apply(listener.obj, inProgress.args);
            listener.status = inProgress.doneId;
         }
      }

   }
}

export let dispatcher: Dispatcher = new Dispatcher();
