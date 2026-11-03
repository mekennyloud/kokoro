// Все разделы приложения. Новый раздел (траты, журнал, спорт…) — новый файл рядом
// с { id, title, icon, mount(root) → функция отписки } и строка в списке ниже.
import thoughts from './thoughts.js';
import settings from './settings.js';

/** разделы в навигации, по порядку */
export const sections = [thoughts];

/** служебные экраны: открываются кнопкой в углу, в навигации их нет */
export const extras = [settings];
