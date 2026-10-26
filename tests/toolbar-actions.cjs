/* Exercise the same disclosed navigation used by a person before an action. */
// All secondary commands now share the single More menu.

exports.toolbarAction=async(page,selector)=>{const button=page.locator(selector);if(!await button.isVisible()){await page.click('#toolbar-create');}await button.click();};
