// Все разделы приложения. Новый раздел (траты, журнал, спорт…) — новый файл рядом
// с { id, title, short?, icon (имя из core/icons.js), mount(root) → функция отписки } и строка в списке ниже.
import home from './home.js';
import thoughts from './thoughts.js';
import tasks from './tasks.js';
import later from './later.js';
import calendar from './calendar.js';
import uneasy from './uneasy.js';
import settings from './settings.js';

/** разделы в нижнем меню, по порядку; первый открывается при запуске */
export const sections = [home, thoughts, tasks, uneasy, later];

/** открываются из меню «⋯», в нижнем меню их нет */
export const extras = [calendar, settings];
