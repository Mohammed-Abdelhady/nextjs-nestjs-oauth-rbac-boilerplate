from integrate import *
import re
C=pathlib.Path(json.loads((E/'candidate.json').read_text())['path']);env=json.loads((E/'environment.json').read_text());projection=json.loads((E/'projection.json').read_text());formatting=[]
for name in ('frontend/e2e/README.md','.hyperflow/reports/production-hardening.md','.hyperflow/reports/audit-status.md'):
 original=(S/name).read_bytes();current=(C/name).read_bytes()
 r=subprocess.run(['node','node_modules/prettier/bin/prettier.cjs','--stdin-filepath',name],input=original,cwd=C,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 assert r.returncode==0 and r.stdout==current,name
 formatting.append({'path':name,'formatting_only_verified':True,'source_sha256':hashlib.sha256(original).hexdigest(),'candidate_sha256':hashlib.sha256(current).hexdigest()});projection[name]['blob']=blob(current);projection[name]['sha256']=hashlib.sha256(current).hexdigest()
name='backend/.env.example'
original=(S/name).read_bytes();current=(C/name).read_bytes();assert current==original[:-1] and original.endswith(b'\n\n')
projection[name]['blob']=blob(current);projection[name]['sha256']=hashlib.sha256(current).hexdigest()
formatting.append({'path':name,'formatting_only_verified':True,'change':'one final newline removed'})
def cg(*args):return subprocess.check_output(['git',*args],cwd=C,env=env)
actual={}
for entry in cg('ls-tree','-rz','HEAD').split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t');mode,kind,oid=meta.decode().split();name=name.decode();actual[name]={'mode':mode,'blob':oid}
assert set(actual)==set(projection)
for name,entry in actual.items():
 assert entry['mode']==projection[name]['mode'] and entry['blob']==projection[name]['blob'],name
 assert blob((C/name).read_bytes())==entry['blob'],('worktree changed',name)
assert not cg('status','--porcelain=v1','-uno')
changes=set(cg('diff','--no-renames','--name-only','-z',BASE,'HEAD').decode().split('\0')[:-1]);expected=set(sum([sum(g['projected_paths'].values(),[]) for g in json.loads((E/'groups.json').read_text())],[]));assert changes==expected
assert subprocess.run(['git','diff','--check',BASE,'HEAD'],cwd=C,env=env,stdout=subprocess.PIPE).returncode==0
# All accepted snapshot inputs are unchanged except verified Markdown formatting.
snapshot_mismatch=[]
for name in actual:
 if name.startswith('.hyperflow/') or name in {x['path'] for x in formatting}:continue
 p=SAFE/name
 if p.exists() and p.is_file() and not p.is_symlink() and p.read_bytes()!=(C/name).read_bytes():snapshot_mismatch.append(name)
assert set(snapshot_mismatch)=={'.dockerignore','.github/workflows/ci.yml','.gitignore','nginx/nginx.conf'},snapshot_mismatch
head=cg('rev-parse','HEAD').decode().strip();tree=cg('rev-parse','HEAD^{tree}').decode().strip()
dump('hook-formatting.json',formatting);dump('final-projection.json',projection);dump('candidate-verification.json',{'head':head,'tree':tree,'files':len(actual),'delta':len(changes),'exact_scope':True,'worktree_clean':True,'snapshot_mismatches':snapshot_mismatch,'formatting_only_paths':[x['path'] for x in formatting],'projection_sha256':hashlib.sha256(json.dumps(projection,sort_keys=True).encode()).hexdigest(),'base_ancestor':BASE,'commits':cg('rev-list','--reverse',BASE+'..HEAD').decode().splitlines()});print(json.dumps({'head':head,'files':len(actual),'delta':len(changes),'exact_scope':True,'snapshot_mismatches':snapshot_mismatch,'formatting_only_paths':[x['path'] for x in formatting]}))
