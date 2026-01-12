# NPM Publishing Quick Start

## ✅ What's Been Set Up

### 1. Package Configuration
- ✅ Backend renamed to `@wford26/bettrack-backend`
- ✅ Frontend renamed to `@wford26/bettrack-frontend`
- ✅ Both removed `"private": true` flag
- ✅ Added `files` field (what gets published)
- ✅ Added `publishConfig` for GitHub Packages
- ✅ Added repository, keywords, author metadata

### 2. Publishing Infrastructure
- ✅ `.npmignore` files created (backend & frontend)
- ✅ GitHub Actions workflow: `.github/workflows/npm-publish-dashboard.yml`
- ✅ `.npmrc` for GitHub Packages authentication
- ✅ Complete documentation: `NPM-PUBLISHING.md`

### 3. CHANGELOGs Updated
- ✅ Backend CHANGELOG.md
- ✅ Frontend CHANGELOG.md
- ✅ Dashboard root CHANGELOG.md
- ✅ README.md with NPM installation instructions

## 🚀 Next Steps (What You Need To Do)

### Step 1: Test Package Contents
```bash
# Backend - check what will be published
cd dashboard/backend
npm pack --dry-run

# Frontend - check what will be published
cd dashboard/frontend
npm pack --dry-run
```

### Step 2: Commit Changes
```bash
cd ../../  # Back to repo root
git add .
git commit -m "feat(dashboard): add NPM publishing infrastructure for GitHub Packages"
git push
```

### Step 3: Test Publishing (Manual)

#### Option A: Via GitHub Actions (Recommended)
1. Go to repo → Actions → "Publish Dashboard Packages"
2. Click "Run workflow"
3. Select "both" to publish backend and frontend

#### Option B: Locally
```bash
# Authenticate with GitHub Packages (one-time setup)
# Replace YOUR_GITHUB_PAT with actual token
echo "@wford26:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT" >> ~/.npmrc

# Backend
cd dashboard/backend
npm run build
npm publish

# Frontend
cd dashboard/frontend
npm run build
npm publish
```

### Step 4: Automated Publishing via Releases

Once tested, future releases are automatic:

```bash
# Create a release (automatically triggers publishing)
gh release create dashboard-v0.2.0 \
  --title "Dashboard v0.2.0" \
  --notes "Release notes here"
```

## 📦 Package Locations

After publishing, packages appear here:
- **Backend**: https://github.com/WFord26/Sports-Odds-MCP/pkgs/npm/bettrack-backend
- **Frontend**: https://github.com/WFord26/Sports-Odds-MCP/pkgs/npm/bettrack-frontend

## 🔧 Usage

Others can install your packages with:

```bash
# Setup (one-time)
echo "@wford26:registry=https://npm.pkg.github.com" >> ~/.npmrc
# Add GitHub PAT with read:packages permission

# Install
npm install @wford26/bettrack-backend
npm install @wford26/bettrack-frontend
```

## 📝 Files Created

- `dashboard/backend/.npmignore` - Exclude dev files
- `dashboard/frontend/.npmignore` - Exclude dev files
- `dashboard/.npmrc` - GitHub Packages config
- `.github/workflows/npm-publish-dashboard.yml` - Publishing automation
- `dashboard/NPM-PUBLISHING.md` - Complete documentation

## 📚 Files Modified

- `dashboard/backend/package.json` - Scoped name, publishConfig
- `dashboard/frontend/package.json` - Scoped name, publishConfig
- `dashboard/backend/CHANGELOG.md` - NPM setup notes
- `dashboard/frontend/CHANGELOG.md` - NPM setup notes
- `dashboard/CHANGELOG.md` - NPM infrastructure summary
- `dashboard/README.md` - Installation instructions

## ⚠️ Important Notes

1. **GitHub PAT Required**: Users need a GitHub Personal Access Token with `read:packages` to install
2. **Scope Locked**: Package names use `@wford26` scope (matches your GitHub username)
3. **GitHub Packages Only**: Currently configured for GitHub Packages, not public NPM
4. **Automatic Publishing**: Releases trigger automatic publishing via GitHub Actions
5. **No Secrets Needed**: Workflow uses `GITHUB_TOKEN` (auto-provided by Actions)

## 🎯 Testing Checklist

Before first publish:
- [ ] Run `npm pack --dry-run` for both packages
- [ ] Verify `.npmignore` excludes correct files
- [ ] Check `files` field includes required assets
- [ ] Build both packages locally (`npm run build`)
- [ ] Test workflow manually via GitHub Actions
- [ ] Verify packages appear in GitHub Packages after publish
- [ ] Test installation on another machine

## 🔄 Migrating to Public NPM (Future)

If you want to publish to public NPM instead:

1. Update both package.json files:
   ```json
   "publishConfig": {
     "access": "public"
   }
   ```
   (Remove `"registry"` field)

2. Remove `dashboard/.npmrc`

3. Update workflow to use NPM token:
   ```yaml
   NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```

4. Change setup-node registry:
   ```yaml
   registry-url: 'https://registry.npmjs.org'
   ```

---

**Ready to publish!** Start with Step 1 above.
