// Все разделы приложения. Новый раздел (траты, журнал, спорт…) — новый файл рядом
// с { id, title, short?, icon, mount(root) → функция отписки } и строка в списке ниже.
import home from './home.js';
import thoughts from './thoughts.js';
import tasks from './tasks.js';
import later from './later.js';
import calendar from './calendar.js';
import uneasy from './uneasy.js';
import settings from './settings.js';

/** разделы в навигации, по порядку; первый открывается при запуске */
export const sections = [home, thoughts, tasks, later, calendar, uneasy];

/** служебные экраны: открываются из меню «⋯», в навигации их нет */
export const extras = [settings];
