import json,subprocess,pathlib,os,hashlib,shutil,tempfile,time
S=pathlib.Path.cwd(); E=S/'.hyperflow/evidence/t30-release-native'; M=json.loads((S/'.hyperflow/evidence/t30-integration/manifest.json').read_text()); P=json.loads((S/'.hyperflow/evidence/t30-integration/projection-metadata.json').read_text()); BASE=P['base']
NODE=S/'.hyperflow/evidence/t21-e/node22/node-v22.18.0-darwin-arm64/bin'; SAFE=pathlib.Path('/var/folders/d1/tk4y3j012j57stv_sy0qpglr0000gn/T/t29b-safe-jke84nuk'); EXAMPLES={'.env.docker.example','backend/.env.example','frontend/.env.example'}
def permitted(name):
 p=pathlib.PurePosixPath(name)
 return not p.is_absolute() and '..' not in p.parts and (not (p.name=='.env' or p.name.startswith('.env.')) or name in EXAMPLES) and p.suffix not in ('.pem','.key','.crt') and not name.startswith('.hyperflow/')
def git(*args):return subprocess.check_output(['git',*args],cwd=S)
def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def dump(name,data): (E/name).write_text(json.dumps(data,indent=2)+'\n')
if __name__=='__main__':
 assert git('rev-parse','HEAD').decode().strip()==P['source_head']
 assert git('ls-remote','origin','refs/heads/master','refs/heads/feat/production-hardening').decode().strip()==BASE+'\trefs/heads/master'
 assert json.loads(subprocess.check_output(['gh','pr','list','--repo','Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate','--head','feat/production-hardening','--state','all','--json','number']))==[]
 final={}
 for line in git('ls-tree','-rz',BASE).split(b'\0'):
  if not line:continue
  meta,name=line.split(b'\t');mode,kind,oid=meta.decode().split();name=name.decode()
  assert permitted(name) and kind=='blob' and mode in ('100644','100755'),name
  final[name]={'mode':mode,'blob':oid,'origin':'base'}
 for op in P['operations']:
  name=op['path'];assert permitted(name),name
  if op['operation']=='deleted':final.pop(name);continue
  expected=op['source'];p=S/name;assert p.is_file() and not p.is_symlink(),name
  data=p.read_bytes();assert blob(data)==expected['blob'],('source drift',name)
  final[name]={'mode':expected['mode'],'blob':blob(data),'sha256':hashlib.sha256(data).hexdigest(),'origin':'source'}
 for name in ('.hyperflow/reports/production-hardening.md','.hyperflow/reports/audit-status.md'):
  data=(S/name).read_bytes();final[name]={'mode':'100644','blob':blob(data),'sha256':hashlib.sha256(data).hexdigest(),'origin':'source'}
 C=pathlib.Path(tempfile.mkdtemp(prefix='production-hardening-integration-')); dump('candidate.json',{'path':str(C),'base':BASE,'source_head':P['source_head'],'files':len(final)})
 tool=E/'tool-config';tool.mkdir();(tool/'npmrc').write_text('');(tool/'global-npmrc').write_text('');(tool/'xdg').mkdir();(tool/'tmp').mkdir()
 env={'PATH':str(NODE)+':/usr/bin:/bin:/usr/sbin:/sbin','TMPDIR':str(tool/'tmp'),'XDG_CONFIG_HOME':str(tool/'xdg'),'NPM_CONFIG_USERCONFIG':str(tool/'npmrc'),'NPM_CONFIG_GLOBALCONFIG':str(tool/'global-npmrc'),'NPM_CONFIG_CACHE':str(tool/'npm-cache'),'NEXT_PUBLIC_API_URL':'http://127.0.0.1:5107','PLAYWRIGHT_CHROMIUM_CHANNEL':'chrome'}
 dump('environment.json',env)
 def cmd(*args):subprocess.run(args,cwd=C,env=env,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 cmd('git','init','-b','integration/production-hardening','.')
 cmd('git','fetch','--no-tags',str(S),BASE);cmd('git','update-ref','refs/heads/integration/production-hardening','FETCH_HEAD');cmd('git','read-tree',BASE)
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=C).decode().strip()==BASE
 for name,entry in final.items():
  dest=C/name;dest.parent.mkdir(parents=True,exist_ok=True)
  data=(S/name).read_bytes() if entry['origin']=='source' else git('cat-file','blob',entry['blob'])
  assert blob(data)==entry['blob'];dest.write_bytes(data);dest.chmod(0o755 if entry['mode']=='100755' else 0o644)
 # Copy only the approved identity/signing settings, without printing identity values.
 config_keys=['user.name','user.email','user.signingkey','commit.gpgsign','tag.gpgsign','gpg.format','gpg.program','gpg.ssh.program']
 for key in config_keys:
  value=subprocess.run(['git','config','--get',key],cwd=S,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  if value.returncode==0:cmd('git','config','--local',key,value.stdout.decode().rstrip('\n'))
 cmd('git','var','GIT_AUTHOR_IDENT');cmd('git','remote','add','origin','https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate.git')
 dump('projection.json',final)
 groups=M['commit_groups']
 groups[-1]['projected_paths']['new']+=['.hyperflow/reports/production-hardening.md','.hyperflow/reports/audit-status.md']
 for group in groups:
  names=sum(group['projected_paths'].values(),[]);(E/(group['id']+'.paths')).write_bytes(b'\0'.join(n.encode() for n in names)+b'\0')
 dump('groups.json',groups)
 print(json.dumps({'candidate':str(C),'files':len(final),'delta':sum(sum(len(a) for a in g['projected_paths'].values()) for g in groups),'projection_sha256':hashlib.sha256(json.dumps(final,sort_keys=True).encode()).hexdigest()}),flush=True)
 for workspace in ('','backend','frontend','packages/create-nest-next-auth'):
  src=SAFE/workspace/'node_modules';dest=C/workspace/'node_modules'
  if src.exists():shutil.copytree(src,dest,symlinks=True)
 for root,dirs,files in os.walk(C):
  for name in dirs+files:
   p=pathlib.Path(root)/name
   if p.is_symlink():
    target=os.readlink(p)
    if os.path.isabs(target):
     target_path=pathlib.Path(target)
     assert target_path.is_relative_to(SAFE),('outside dependency link',str(p))
     p.unlink();p.symlink_to(os.path.relpath(C/target_path.relative_to(SAFE),p.parent))
    assert p.resolve().is_relative_to(C),('escaping dependency link',str(p))
 cmd('npm','run','prepare')
 assert subprocess.check_output(['git','config','--get','core.hooksPath'],cwd=C,env=env).decode().strip()=='.husky/_'
 for name in ('pre-commit','commit-msg','pre-push'):assert os.access(C/'.husky/_'/name,os.X_OK)
 dump('setup.json',{'complete':True,'hooks_path':'.husky/_','dispatchers_executable':True,'dependencies':'four workspace importer directories copied; all links resolve within candidate','original_git_unchanged':True})
 print('candidate and genuine hooks ready',flush=True)
