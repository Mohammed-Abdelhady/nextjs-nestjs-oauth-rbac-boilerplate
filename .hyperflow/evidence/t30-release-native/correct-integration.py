from integrate import *
C=pathlib.Path(json.loads((E/'candidate.json').read_text())['path']);env=json.loads((E/'environment.json').read_text());dump('environment-before-tmp-fix.json',env)
tmp=pathlib.Path(tempfile.mkdtemp(prefix='production-hardening-gates-'))
assert not any((p/'package.json').exists() for p in [tmp,*tmp.parents])
env['TMPDIR']=str(tmp);dump('environment.json',env)
name='backend/.env.example';p=C/name;before=p.read_bytes();assert before.endswith(b'\n\n') and not before.endswith(b'\n\n\n');after=before[:-1];p.write_bytes(after)
dump('example-formatting.json',{'path':name,'before_sha256':hashlib.sha256(before).hexdigest(),'after_sha256':hashlib.sha256(after).hexdigest(),'change':'remove exactly one trailing newline byte; all other bytes identical','original_source_unchanged':(S/name).read_bytes()==before})
subprocess.run(['git','add','--',name],cwd=C,env=env,check=True)
assert subprocess.check_output(['git','diff','--cached','--name-only'],cwd=C,env=env).decode().strip()==name
with (E/'example-formatting-commit.log').open('w') as log:r=subprocess.run(['git','commit','-m','style(backend): remove extra environment example blank line'],cwd=C,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=120)
assert r.returncode==0
dump('example-formatting-commit.json',{'exit':r.returncode,'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=C,env=env).decode().strip()})
print('Owned external temporary directory configured; example EOF formatting committed with genuine hooks')
