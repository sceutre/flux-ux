import {Director} from './directors';
import {dispatchAction} from './dispatcher';

export interface Listener {
   callback: Function;
   obj: Director;
   status: number;
}

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
      dispatchAction(this.listeners, this, args);
   }) as any;

}
