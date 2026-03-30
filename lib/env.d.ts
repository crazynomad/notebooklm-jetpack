declare const __GIT_HASH__: string;
declare const __BUILD_TIME__: string;
declare const __VERSION__: string;

declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';
  export function tables(service: TurndownService): void;
  export function strikethrough(service: TurndownService): void;
  export function taskListItems(service: TurndownService): void;
  export const gfm: (service: TurndownService) => void;
}
