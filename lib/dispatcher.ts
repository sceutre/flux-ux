import {Action, Listener} from './action';
import {Director} from './directors';

interface InProgress {
   action: Action<any>;
   args: any[];
   listeners: Listener[];
   startedId:number;
   doneId:number;
}

let stage = 0;
let inProgress:InProgress|null = undefined;

export function dispatchAction(listeners: Listener[], action: Action<any>, args: any[]) {
   if (inProgress)
      throw new Error(`Trying to fire ${action.name} while another action ${inProgress.action.name} is firing.  Actions begetting actions is not allowed as it makes behavior very complex.`);
   inProgress = {
      action: action,
      args: args,
      listeners: listeners,
      startedId: stage + 1,
      doneId: stage + 2
   };
   stage = inProgress.doneId;
   try {
      dispatchLoop();
   } finally {
      inProgress = undefined;
   }
}

function dispatchLoop(onlyDirectors?: Director[]) {
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

export function waitFor(directors: Director[]) {
   dispatchLoop(directors);
}
