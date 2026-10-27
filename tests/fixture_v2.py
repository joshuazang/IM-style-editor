"""Independent format-2 fixture writer. Deterministic IDs are test data only."""
import base64,copy,json,re

def fixture_id(label):
 if re.fullmatch(r'[A-Za-z0-9_-]{21}[AQgw]',label):return label
 return base64.urlsafe_b64encode(label.encode()[:16].ljust(16,b'\0')).decode().rstrip('=')

def fixture_messages(messages):
 result=copy.deepcopy(messages)
 for message in result:message['id']=fixture_id(message['id'])
 return result

CONTROLS={'@@IM:SETTINGS','@@IM:END-SETTINGS','@@IM:BUBBLE','@@IM:TEXT','@@IM:END-BUBBLE','@@IM:END'}
def document(messages,settings):
 mapping={'bubbleTheme':'bubble-theme','backgroundTheme':'background-theme','wallpaper':'wallpaper','artwork':'artwork','scale':'scale','reactionOrder':'reaction-order','deletedEmojis':'deleted-emojis'}
 bubble={'id':'id','createdAt':'created','editedAt':'edited','reactions':'reactions','separatorAfter':'separator-after','forwarding':'forwarding'}
 dump=lambda value:json.dumps(value,ensure_ascii=False,separators=(',',':'))
 def fields(values,mapping,extra):
  result=[f'{label}: {dump(values[key])}' for key,label in mapping.items() if key in values]
  unknown={k:v for k,v in values.items() if k not in mapping and (extra!='extra-metadata' or k!='text')}
  if unknown:result.append(f'{extra}: {dump(unknown)}')
  return result
 lines=['#!im-style-editor 2','#!encoding utf-8','='*60,'@@IM:SETTINGS',*fields(settings,mapping,'extra-settings'),'@@IM:END-SETTINGS','='*60]
 for message in messages:
  body='\n'.join(('\\'+line if line.startswith('\\') or line.removesuffix('\r') in CONTROLS else line) for line in message['text'].split('\n'))
  lines+=['@@IM:BUBBLE',*fields(message,bubble,'extra-metadata'),'-'*60,'@@IM:TEXT',body,'@@IM:END-BUBBLE','='*60]
 return '\n'.join([*lines,'@@IM:END',''])

def prepare_note(note):
 result=copy.deepcopy(note)
 if 'appendEditorMessageData' in result.get('content',{}):
  result['content']['appendEditorMessageData']=fixture_messages(result['content']['appendEditorMessageData'])
  result['content']['text']=document(result['content']['appendEditorMessageData'],result['content'].get('appendEditorSettings',{}))
 return result
