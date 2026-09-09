import pathlib,json,subprocess,hashlib,time
E=pathlib.Path(__file__).resolve().parent;C=pathlib.Path(json.loads((E/'preflight.json').read_text())['candidate']);env=json.loads((E.parent/'t30-release-native/environment.json').read_text());env['GIT_TERMINAL_PROMPT']='0'
def git(*args):return subprocess.check_output(['git',*args],cwd=C,env=env)
base='954b99a319d171d8dd488372fda6f4f530440dce';head=git('rev-parse','HEAD').decode().strip()
assert git('ls-remote','origin','refs/heads/feat/production-hardening').decode().split()[0]==base
assert not git('status','--porcelain=v1')
m=json.loads((E.parent/'sessions-320-repair/aggregate-seven-path-manifest.json').read_text());allowed={f['path'] for f in m['files']}|{'.hyperflow/reports/production-hardening.md','.hyperflow/reports/audit-status.md'}
assert set(git('diff','--name-only',base,head).decode().splitlines())==allowed
assert all(hashlib.sha256((C/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in m['files'])
assert subprocess.run(['git','diff','--check',base,head],cwd=C,env=env).returncode==0
for name,other in [('production-hardening.md','audit-status.md'),('audit-status.md','production-hardening.md')]:assert ']('+other+')' in (C/'.hyperflow/reports'/name).read_text()
assert 'FINAL_PUSHED_REVISION' not in ''.join((C/'.hyperflow/reports'/n).read_text() for n in ['production-hardening.md','audit-status.md'])
print('START normal push with genuine lint/typecheck/root-test hook',flush=True);start=time.time()
with (E/'push.log').open('w') as log:r=subprocess.run(['git','push','origin','HEAD:refs/heads/feat/production-hardening'],cwd=C,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=360)
(E/'push.json').write_text(json.dumps({'exit':r.returncode,'seconds':round(time.time()-start,2),'head':head},indent=2));print('push exit',r.returncode,flush=True)
if r.returncode:raise SystemExit(r.returncode)
remote=git('ls-remote','origin','refs/heads/feat/production-hardening').decode().split()[0];assert remote==head
pr=json.loads(subprocess.check_output(['gh','pr','view','72','--json','number,state,isDraft,headRefOid,headRefName,baseRefName,url'],cwd=C));assert pr['headRefOid']==head and pr['isDraft'] and pr['state']=='OPEN';assert not git('status','--porcelain=v1')
(E/'remote-pr.json').write_text(json.dumps(pr,indent=2));(E/'release-manifest.json').write_text(json.dumps({'head':head,'tree':git('rev-parse','HEAD^{tree}').decode().strip(),'remote_head':remote,'paths':[{'path':p,'sha256':hashlib.sha256((C/p).read_bytes()).hexdigest()} for p in sorted(allowed)],'candidate_clean':True,'ledger_rows_exact':137},indent=2));print(json.dumps(pr),flush=True)
