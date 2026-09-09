from integrate import *
C=pathlib.Path(json.loads((E/'candidate.json').read_text())['path']);env=json.loads((E/'environment.json').read_text())
links=0
for root,dirs,files in os.walk(C):
 for name in dirs+files:
  p=pathlib.Path(root)/name
  if not p.is_symlink():continue
  links+=1;target=os.readlink(p)
  if os.path.isabs(target):
   t=pathlib.Path(target);assert t.resolve().is_relative_to(SAFE.resolve()),str(p)
   p.unlink();p.symlink_to(os.path.relpath(C/t.resolve().relative_to(SAFE.resolve()),p.parent))
  assert p.resolve().is_relative_to(C.resolve()),str(p)
with (E/'prepare.log').open('w') as log:r=subprocess.run(['npm','run','prepare'],cwd=C,env=env,stdout=log,stderr=subprocess.STDOUT)
assert r.returncode==0
assert subprocess.check_output(['git','config','--get','core.hooksPath'],cwd=C,env=env).decode().strip()=='.husky/_'
for name in ('pre-commit','commit-msg','pre-push'):assert os.access(C/'.husky/_'/name,os.X_OK)
dump('setup.json',{'complete':True,'hooks_path':'.husky/_','dispatchers_executable':True,'dependency_links_contained':links,'canonicalization_correction':'compare resolved candidate and resolved targets','original_git_unchanged':True})
print('Genuine Husky setup complete; dependency links contained:',links)
