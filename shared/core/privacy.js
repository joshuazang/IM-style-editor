/* Privacy defaults are shared by both interfaces and temporary clipboard fields. */
const imPrivateTextProps={spellCheck:false,autoComplete:'off',autoCorrect:'off',autoCapitalize:'off',writingsuggestions:'false'};
function imPrivateTextField(field){
  field.spellcheck=false;
  for(const [name,value] of Object.entries({autocomplete:'off',autocorrect:'off',autocapitalize:'off',writingsuggestions:'false'}))field.setAttribute(name,value);
  return field;
}
/* Note-writing fields allow the device's native proofing and predictive text. */
const imWritingTextAttributes={spellcheck:'true',autocomplete:'on',autocorrect:'on',autocapitalize:'sentences',writingsuggestions:'true'};
function imWritingTextField(field){
  for(const [name,value] of Object.entries(imWritingTextAttributes))field.setAttribute(name,value);
  return field;
}
