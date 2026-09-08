import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('upgrade',ROOT/'tools/install-grouped-actions.py')
u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
plugin=ROOT/u.PLUGIN
catalog=json.loads((plugin/'action-catalog.json').read_text())
manifest=json.loads((plugin/'manifest.json').read_text())

def instance(uuid,settings=None,controller='Keypad'):
 return {'action':{'uuid':uuid,'plugin':u.PLUGIN,'name':'Old','property_inspector':'old.html','encoder':{'layout':{'custom':'retained'}} if controller=='Encoder' else None},'context':controller+'.1.0','states':[{'image':'1.svg','title':'User label','font_size':17}],'current_state':0,'settings':settings or {'step':7,'holdMs':150,'textMode':'manual','buttonText':'Guitar'},'children':None}

class Upgrade(unittest.TestCase):
 def test_every_grouped_action_migrates_and_nested_children_and_artwork_survive(self):
  old=catalog['groups'];items=[instance(o['uuid'],controller=o['controller']) for g in old for o in g['operations']]
  p={'keys':[None,{'action':{'uuid':'opendeck.multiaction','plugin':'opendeck'},'settings':{},'children':items}],'sliders':[],'infobars':[]}
  original=copy.deepcopy(p);changed,count=u.convert_profile(p,catalog,manifest)
  self.assertEqual(count,51);self.assertEqual(p,original)
  for before,after in zip(items,changed['keys'][1]['children']):
   self.assertEqual(after['settings']['operation'],before['action']['uuid'])
   self.assertEqual(after['states'],before['states']);self.assertEqual(after['context'],before['context'])
   self.assertEqual(after['action']['encoder'],before['action']['encoder']);self.assertEqual(after['settings']['buttonText'],'Guitar')
   self.assertTrue(after['action']['property_inspector'].endswith('/grouped.html'))
  again,count=u.convert_profile(changed,catalog,manifest);self.assertEqual(count,0);self.assertEqual(again,changed)
 def test_nested_fade_descriptors_seconds_and_unrelated_actions_are_preserved(self):
  app=instance('com.pipeweaver.opendeck.appvolumefade',{'application':{'name':'Brave','process':'/opt/brave (deleted)','deviceType':'Source'},'seconds':0.75,'volume':20})
  device=instance('com.pipeweaver.opendeck.physinvolumefade',{'device':{'id':'mic','name':'Mic'},'milliseconds':250,'volume':70})
  other=instance('another.action',{'operation':'foo'});other['action']['plugin']='another.plugin'
  p={'keys':[app,device,other],'sliders':[]};result,count=u.convert_profile(p,catalog,manifest)
  self.assertEqual(count,2);self.assertEqual(result['keys'][0]['settings']['milliseconds'],750);self.assertEqual(result['keys'][0]['settings']['process'],'/opt/brave (deleted)')
  self.assertEqual(result['keys'][1]['settings']['deviceId'],'mic');self.assertEqual(result['keys'][1]['settings']['milliseconds'],250);self.assertEqual(result['keys'][2],other)
 def fixture(self):
  temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup);base=Path(temp.name);config=base/'opendeck';(config/'profiles/device').mkdir(parents=True);(config/'plugins'/u.PLUGIN).mkdir(parents=True)
  (config/'plugins'/u.PLUGIN/'old.txt').write_text('old plugin')
  profile=config/'profiles/device/Default.json';profile.write_text(json.dumps({'keys':[instance('com.pipeweaver.opendeck.physinmute')],'sliders':[]}))
  package=base/'plugin.zip'
  with zipfile.ZipFile(package,'w') as z:
   z.writestr(u.PLUGIN+'/manifest.json',json.dumps({**manifest,'Version':'0.23.0'}));z.writestr(u.PLUGIN+'/action-catalog.json',json.dumps(catalog));z.writestr(u.PLUGIN+'/plugin.js','new plugin')
  package.with_suffix('.sha256').write_text(hashlib.sha256(package.read_bytes()).hexdigest())
  return config,profile,package
 def test_preview_does_not_write_and_apply_keeps_byte_exact_backups(self):
  config,profile,package=self.fixture();original=profile.read_bytes()
  with patch.object(u,'opendeck_running',return_value=False),patch('builtins.print'):
   u.install(config,package);self.assertEqual(profile.read_bytes(),original);self.assertFalse((config/'weaverdeck-backups').exists())
   u.install(config,package,apply=True)
  self.assertEqual(json.loads(profile.read_text())['keys'][0]['action']['uuid'],'com.pipeweaver.opendeck.physicalinput')
  backup=next((config/'weaverdeck-backups').iterdir());self.assertEqual((backup/'profiles/device/Default.json').read_bytes(),original)
  self.assertEqual((backup/'plugins'/u.PLUGIN/'old.txt').read_text(),'old plugin')
  self.assertEqual((config/'plugins'/u.PLUGIN/'plugin.js').stat().st_mode & 0o777,0o755)
 def test_write_failure_rolls_back_plugin_and_profiles(self):
  config,profile,package=self.fixture();before=profile.read_bytes();original=u.atomic_write
  def fail(path,data,mode):
   if path==profile:raise OSError('simulated write failure')
   return original(path,data,mode)
  with patch.object(u,'opendeck_running',return_value=False),patch.object(u,'atomic_write',side_effect=fail),patch('builtins.print'):
   with self.assertRaises(OSError):u.install(config,package,apply=True)
  self.assertEqual(profile.read_bytes(),before);self.assertEqual((config/'plugins'/u.PLUGIN/'old.txt').read_text(),'old plugin')
 def test_device_selection_metadata_is_not_a_button_profile(self):
  config,profile,package=self.fixture()
  metadata=config/'profiles/device.json'
  original=b'{\n  "selected_profile": "Default"\n}\n';metadata.write_bytes(original)
  with patch.object(u,'opendeck_running',return_value=False),patch('builtins.print'):
   u.install(config,package);self.assertEqual(metadata.read_bytes(),original)
   u.install(config,package,apply=True)
  self.assertEqual(metadata.read_bytes(),original)
  self.assertEqual(json.loads(profile.read_text())['keys'][0]['action']['uuid'],'com.pipeweaver.opendeck.physicalinput')
  backup=next((config/'weaverdeck-backups').iterdir())
  self.assertTrue((backup/'profiles/device/Default.json').is_file())
 def test_invalid_profile_names_file_and_is_not_skipped_as_metadata(self):
  config,profile,package=self.fixture()
  for value in ({'selected_profile':'Default'}, {'keys':[], 'sliders':'bad', 'selected_profile':'Default'}):
   profile.write_text(json.dumps(value))
   with patch.object(u,'opendeck_running',return_value=False):
    with self.assertRaisesRegex(ValueError,r'profiles/device/Default.json: Unrecognized'):
     u.install(config,package,apply=True)
   self.assertFalse((config/'weaverdeck-backups').exists())
   self.assertTrue((config/'plugins'/u.PLUGIN/'old.txt').exists())
 def test_invalid_json_names_file_and_unknown_root_metadata_still_stops(self):
  config,profile,package=self.fixture();metadata=config/'profiles/device.json'
  for value in ('{', '{"selected_profile":42}', '{"unexpected":[]}'):
   metadata.write_text(value)
   with patch.object(u,'opendeck_running',return_value=False):
    with self.assertRaisesRegex(ValueError,r'profiles/device.json:'):
     u.install(config,package,apply=True)
   self.assertFalse((config/'weaverdeck-backups').exists())
 def test_running_host_invalid_profile_and_wrong_checksum_stop_before_install(self):
  config,profile,package=self.fixture()
  with patch.object(u,'opendeck_running',return_value=True):
   with self.assertRaises(RuntimeError):u.install(config,package,apply=True)
  with patch.object(u,'opendeck_running',return_value=False):
   profile.write_text('{"unexpected": []}')
   with self.assertRaises(ValueError):u.install(config,package,apply=True)
   package.with_suffix('.sha256').write_text('wrong')
   with self.assertRaises(ValueError):u.install(config,package,apply=True)
  self.assertTrue((config/'plugins'/u.PLUGIN/'old.txt').exists());self.assertFalse((config/'weaverdeck-backups').exists())

if __name__=='__main__':unittest.main()
