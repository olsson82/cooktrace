/**
 * cookMode — global flag for "the user is currently in Cook Mode on a
 * recipe page". Used to hand off the cook-timer rail from its global
 * floating mount (App.svelte) to an inline embed inside the recipe
 * page (RecipeView) so the floating panel doesn't compete with the
 * step text while the user is actively cooking.
 */
import { writable } from 'svelte/store';

export const cookModeActive = writable(false);

/**
 * recipeViewActive — true while a RecipeView component is mounted.
 * Lets App.svelte suppress the floating-bottom CookTimerRail when the
 * recipe page is itself rendering a top-anchored timer pill, so the
 * two don't double up.
 */
export const recipeViewActive = writable(false);
