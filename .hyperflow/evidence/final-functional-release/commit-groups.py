import pathlib,json,subprocess,hashlib,time,sys
E=pathlib.Path(__file__).resolve().parent
C=pathlib.Path(json.loads((E/'preflight.json').read_text())['candidate'])
env=json.loads((E.parent/'t30-release-native/environment.json').read_text())
M=json.loads((E.parent/'sessions-320-repair/aggregate-seven-path-manifest.json').read_text())
groups=[('frontend','fix(frontend): retain responsive controls and restore session dialog focus',[f['path'] for f in M['files'] if f['path'].startswith('frontend/')]),('probes','fix(root): verify the localized application SSR contract',[f['path'] for f in M['files'] if f['path'].startswith('scripts/')]),('reports','docs: record verified functional repairs and release boundaries',['.hyperflow/reports/production-hardening.md','.hyperflow/reports/audit-status.md'])]
def git(*args):return subprocess.check_output(['git',*args],cwd=C,env=env)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for name,message,paths in groups:
 assert not git('diff','--cached','--name-only')
 before={p:(C/p).read_bytes() for p in paths}
 subprocess.run(['git','add','--',*paths],cwd=C,env=env,check=True)
 assert set(git('diff','--cached','--name-only').decode().splitlines())==set(paths)
 print('START genuine commit',name,flush=True);start=time.time()
 with (E/(name+'-commit.log')).open('w') as log:r=subprocess.run(['git','commit','-m',message],cwd=C,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=300)
 changes=[]
 for p in paths:
  if before[p]!=(C/p).read_bytes():
   assert p.endswith('.md'),('unexpected hook source mutation',p)
   formatted=subprocess.run(['node','node_modules/prettier/bin/prettier.cjs','--stdin-filepath',p],input=before[p],cwd=C,env=env,capture_output=True,check=True).stdout
   assert formatted==(C/p).read_bytes(),('not exact formatter parity',p)
   changes.append({'path':p,'prettier_only':True,'before_sha256':hashlib.sha256(before[p]).hexdigest(),'after_sha256':sha(C/p)})
 result={'exit':r.returncode,'seconds':round(time.time()-start,2),'head':git('rev-parse','HEAD').decode().strip(),'paths':paths,'hook_formatting':changes}
 (E/(name+'-commit.json')).write_text(json.dumps(result,indent=2));print(name,result,flush=True)
 if r.returncode:sys.exit(r.returncode)
assert not git('status','--porcelain=v1')
print('All scoped commits complete; candidate clean.',flush=True)
