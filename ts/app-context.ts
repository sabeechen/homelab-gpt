import {createContext} from '@lit-labs/context';
import type {AppData} from './app-data';
export type {AppData} from './app-data';
export const appContext = createContext<AppData>('app');