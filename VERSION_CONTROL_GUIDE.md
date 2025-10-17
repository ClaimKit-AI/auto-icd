# 📝 Version Control Guide

Guide for maintaining version control and releases for the Auto-ICD project.

## 📋 Semantic Versioning

We follow [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH

Example: v1.2.3
         │ │ └─── PATCH: Bug fixes
         │ └───── MINOR: New features (backward compatible)
         └─────── MAJOR: Breaking changes
```

### Version Rules

- **MAJOR (1.x.x)**: Incompatible API changes or major restructuring
- **MINOR (x.1.x)**: New features, backward compatible
- **PATCH (x.x.1)**: Bug fixes, backward compatible

## 🏷️ Current Version: v1.0.0

**Location**: `VERSION` file in project root

**Display**: Bottom-right corner of the UI

## 📝 Making a New Release

### 1. Update Version Files

```bash
# Update VERSION file
echo "1.1.0" > VERSION

# Update package.json files
# - apps/api/package.json
# - apps/web/package.json

# Update version in UI
# - apps/web/src/App.jsx (look for "v1.0.0")
```

### 2. Update CHANGELOG.md

Add new version entry at the top:

```markdown
## [1.1.0] - 2025-MM-DD

### Added
- New feature descriptions

### Changed
- Modified feature descriptions

### Fixed
- Bug fix descriptions

### Deprecated
- Features being phased out

### Removed
- Removed features

### Security
- Security improvements
```

### 3. Commit and Tag

```bash
# Stage all version-related changes
git add VERSION CHANGELOG.md apps/web/src/App.jsx apps/*/package.json

# Commit with clear message
git commit -m "Release v1.1.0: Brief summary

- Feature 1
- Feature 2
- Bug fix 3"

# Create annotated tag
git tag -a v1.1.0 -m "Version 1.1.0 - Release Title

Features:
- Feature 1
- Feature 2"

# Push commit and tag
git push origin <branch-name>
git push origin v1.1.0
```

## 📊 Version History

| Version | Date | Description |
|---------|------|-------------|
| v1.0.0 | 2025-10-17 | Initial production release |

## 🔄 Release Workflow

### For Bug Fixes (Patch Release)

```bash
# Example: v1.0.0 → v1.0.1

# 1. Fix the bug
# 2. Update VERSION: 1.0.1
# 3. Update CHANGELOG.md
# 4. Update UI version display
# 5. Commit: "Release v1.0.1: Fix [bug description]"
# 6. Tag: git tag -a v1.0.1 -m "Bug fix release"
# 7. Push: git push && git push origin v1.0.1
```

### For New Features (Minor Release)

```bash
# Example: v1.0.0 → v1.1.0

# 1. Develop and test features
# 2. Update VERSION: 1.1.0
# 3. Update CHANGELOG.md with all features
# 4. Update UI version display
# 5. Commit: "Release v1.1.0: [Feature summary]"
# 6. Tag: git tag -a v1.1.0 -m "Feature release"
# 7. Push: git push && git push origin v1.1.0
```

### For Breaking Changes (Major Release)

```bash
# Example: v1.0.0 → v2.0.0

# 1. Complete breaking changes
# 2. Update VERSION: 2.0.0
# 3. Update CHANGELOG.md with migration guide
# 4. Update UI version display
# 5. Update README.md with new instructions
# 6. Commit: "Release v2.0.0: [Breaking change summary]"
# 7. Tag: git tag -a v2.0.0 -m "Major release"
# 8. Push: git push && git push origin v2.0.0
```

## 🎯 Quick Commands

```bash
# Check current version
cat VERSION

# List all tags
git tag -l

# View tag details
git show v1.0.0

# Delete a tag (if mistake)
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Check what changed since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

## 📦 Files to Update Per Release

**Required:**
- [ ] `VERSION` - Version number
- [ ] `CHANGELOG.md` - Release notes
- [ ] `apps/web/src/App.jsx` - UI version display
- [ ] `apps/api/package.json` - API version
- [ ] `apps/web/package.json` - Web version

**Optional:**
- [ ] `README.md` - If major changes
- [ ] `DEPLOYMENT.md` - If deployment changes
- [ ] Documentation files - If features added

## 🔐 Version Control Best Practices

1. **Always update CHANGELOG.md** - Document all changes
2. **Use semantic versioning** - Follow the rules strictly
3. **Tag releases** - Makes rollback easier
4. **Test before tagging** - Ensure everything works
5. **Update UI version** - Users should see current version
6. **Clear commit messages** - Explain what changed and why

## 🚨 Rollback Procedure

If a release has issues:

```bash
# Revert to previous version
git revert <commit-hash>

# Or checkout previous tag
git checkout v1.0.0

# Update VERSION file
echo "1.0.0" > VERSION

# Commit rollback
git commit -m "Rollback to v1.0.0 due to [reason]"

# Deploy previous version
cd apps/api
./deploy.sh prod
```

## 📈 Release Checklist

Before creating a new release:

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] VERSION file updated
- [ ] UI version display updated
- [ ] package.json versions updated
- [ ] Production deployment tested
- [ ] Breaking changes documented
- [ ] Migration guide provided (if needed)
- [ ] Team notified of release

---

**Maintained by**: Development Team  
**Last Updated**: 2025-10-17  
**Current Version**: v1.0.0

