// The themes register before any screen's styles are created (theme/unistyles)
import './src/theme/unistyles';
// i18n must be set up before the first screen asks for a translation
import './src/i18n';
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
