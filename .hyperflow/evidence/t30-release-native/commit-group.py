from integrate import *
import sys
C=pathlib.Path(json.loads((E/'candidate.json').read_text())['path']);env=json.loads((E/'environment.json').read_text());group=next(g for g in json.loads((E/'groups.json').read_text()) if g['id']==sys.argv[1]);projection=json.loads((E/'projection.json').read_text())
def cg(*args):return subprocess.check_output(['git',*args],cwd=C,env=env)
existing=set(cg('diff','--cached','--no-renames','--name-only','-z').decode().split('\0')[:-1])
assert not existing or existing==set(sum(group['projected_paths'].values(),[]))
if not existing:subprocess.run(['git','add','--pathspec-from-file='+str(E/(group['id']+'.paths')),'--pathspec-file-nul'],cwd=C,env=env,check=True)
names=sum(group['projected_paths'].values(),[]);assert set(cg('diff','--cached','--no-renames','--name-only','-z').decode().split('\0')[:-1])==set(names)
for name in names:
 entries=cg('ls-files','--stage','-z','--',name).split(b'\0')
 if name in group['projected_paths']['deleted']:assert entries==[b''];continue
 mode,oid,stage=entries[0].split(b'\t')[0].decode().split();assert mode==projection[name]['mode'] and oid==projection[name]['blob'],name
before={name:hashlib.sha256((C/name).read_bytes()).hexdigest() for name in names if (C/name).is_file()}
start=time.time()
with (E/(group['id']+'-commit.log')).open('w') as log:r=subprocess.run(['git','commit','-m',group['message']],cwd=C,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=300)
after={name:hashlib.sha256((C/name).read_bytes()).hexdigest() for name in before}
result={'group':group['id'],'exit':r.returncode,'seconds':round(time.time()-start,2),'changed_by_hook':[name for name in before if before[name]!=after[name]],'head':cg('rev-parse','HEAD').decode().strip()}
dump(group['id']+'-commit.json',result);print(json.dumps(result));sys.exit(r.returncode)
