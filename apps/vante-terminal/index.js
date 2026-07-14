import { registerRootComponent } from 'expo';
import { Alert } from 'react-native';

if (global.ErrorUtils) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    Alert.alert(
      'Error de Arranque',
      `${error.message}\n\nStack:\n${error.stack ? error.stack.substring(0, 300) : ''}`,
      [{ text: 'Cerrar' }]
    );
    if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
}

import App from './App';

registerRootComponent(App);
