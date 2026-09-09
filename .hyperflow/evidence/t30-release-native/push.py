from integrate import *
C=pathlib.Path(json.loads((E/'candidate.json').read_text())['path']);env=json.loads((E/'environment.json').read_text());env['GIT_TERMINAL_PROMPT']='0'
assert git('ls-remote','origin','refs/heads/master','refs/heads/feat/production-hardening').decode().strip()==BASE+'\trefs/heads/master'
assert not json.loads(subprocess.check_output(['gh','pr','list','--repo','Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate','--head','feat/production-hardening','--state','all','--json','number']))
assert not subprocess.check_output(['git','status','--porcelain=v1'],cwd=C,env=env)
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=C,env=env).decode().strip();start=time.time()
print('Normal push started; genuine pre-push gate required',flush=True)
with (E/'push.log').open('w') as log:r=subprocess.run(['git','push','origin','HEAD:refs/heads/feat/production-hardening'],cwd=C,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=300)
dump('push.json',{'exit':r.returncode,'seconds':round(time.time()-start,2),'head':head});print(json.dumps({'push_exit':r.returncode,'head':head}),flush=True)
if r.returncode:raise SystemExit(r.returncode)
remote=subprocess.check_output(['git','ls-remote','origin','refs/heads/feat/production-hardening'],cwd=C).decode().split()[0];assert remote==head
dump('remote-verification.json',{'head':head,'remote_head':remote,'match':True})
