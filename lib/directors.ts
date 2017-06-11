import {AnyExecutiveView as ExecutiveView} from './views';

export class Director {
   constructor(public name: string) { }
}

export class BackendDirector extends Director {}

export class FrontendDirector extends Director {
   private views: ExecutiveView[] = [];

   register(view: ExecutiveView):void {
      if (this.views.indexOf(view) < 0) {
         this.views.push(view);
      }
   }

   unregister(obj: ExecutiveView):void {
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
