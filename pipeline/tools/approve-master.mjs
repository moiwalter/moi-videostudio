#!/usr/bin/env node
// Records the user's real decision; never infers editorial approval from QA.
import {sceneMain} from './scene-state.mjs';
sceneMain('MASTER');
