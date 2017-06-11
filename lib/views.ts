import * as React from "react";
import {FrontendDirector} from './directors';

export type AnyExecutiveView = ExecutiveView<any,any>;

export class ExecutiveView<P,S> extends React.Component<P,S> {
   directors(): FrontendDirector[] {
      return [];
   }

   componentDidMount(): void {
      for (let d of this.directors())
         d.register(this);
   }

   componentWillUnmount(): void {
      for (let d of this.directors())
         d.unregister(this);
   }

   onDirectorChanged(dir:FrontendDirector) {
      this.forceUpdate();
   }
}
