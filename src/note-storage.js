/* The host acknowledges local persistence before this promise resolves. */
function imPersistNote(note) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Save acknowledgment timed out')), 8000);
    pf.postMessage('save-items', { items: [pf.jsonObjectForItem(note)] }, result => {
      clearTimeout(timeout);
      if (result?.error) reject(new Error('The host rejected the note save'));
      else resolve();
    });
  });
}
