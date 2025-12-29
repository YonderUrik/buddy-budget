## [3.0.1](https://github.com/YonderUrik/buddy-budget/compare/v3.0.0...v3.0.1) (2025-12-29)

### Bug Fixes

* Implement user status API fixed authentication flow after onboarding ([9a9479f](https://github.com/YonderUrik/buddy-budget/commit/9a9479f324d54a216f5a628334247ef88a580b16))

## [3.0.0](https://github.com/YonderUrik/buddy-budget/compare/v2.2.1...v3.0.0) (2025-12-29)

### ⚠ BREAKING CHANGES

* Update build script to include Prisma generation

### chore

* Update build script to include Prisma generation ([fc1174a](https://github.com/YonderUrik/buddy-budget/commit/fc1174a5103fe08b5964a923274cbc4b6084e0ca))

## [2.2.1](https://github.com/YonderUrik/buddy-budget/compare/v2.2.0...v2.2.1) (2025-12-29)

### Continuous Integration

* Update deployment workflow to use npm instead of Bun ([343fa1d](https://github.com/YonderUrik/buddy-budget/commit/343fa1da9750771bcda876409ef96193873bc911))

## [2.2.0](https://github.com/YonderUrik/buddy-budget/compare/v2.1.0...v2.2.0) (2025-12-29)

### Features

* Add Prisma schema and user types for database integration ([85d4411](https://github.com/YonderUrik/buddy-budget/commit/85d44118f557d6fb99e804f0efd92fb2505f3ca3))
* Enhance onboarding process with user settings and improved UI ([680fe96](https://github.com/YonderUrik/buddy-budget/commit/680fe96d645ba31ebda10249f08499c0c5351272))
* Implement user authentication and onboarding flow ([7def7d8](https://github.com/YonderUrik/buddy-budget/commit/7def7d891703e40a5f2015ba48faf93bb32a6fda))
* Integrate Prisma for database management ([6bde5ed](https://github.com/YonderUrik/buddy-budget/commit/6bde5ed35b0b94baf7b7abe5be937ae85229a495))
* Revamp onboarding flow and introduce user profile page ([800ba47](https://github.com/YonderUrik/buddy-budget/commit/800ba47fedb19d9b97785660f73135d30f35a03a))

### Bug Fixes

* Update welcome page layout for improved readability ([5c9346e](https://github.com/YonderUrik/buddy-budget/commit/5c9346e7501fcb063e20a4841956ecabd5bc0502))

### Code Refactoring

* Clean up PreferencesPage layout and improve code readability ([912456e](https://github.com/YonderUrik/buddy-budget/commit/912456e161bf8ec035d6a15ccfabbe7c4917ec50))
* Enhance SignInPage structure with Suspense for improved loading experience ([05e4ac6](https://github.com/YonderUrik/buddy-budget/commit/05e4ac6d6417632a4dc663fadbf070098effa7ca))
* Remove financial goals step from onboarding process ([32cd71f](https://github.com/YonderUrik/buddy-budget/commit/32cd71f384e662db1811b8f57f22974286714ab6))

### Tests

* Enhance auth mocks in route tests for improved clarity and structure ([0f2fde6](https://github.com/YonderUrik/buddy-budget/commit/0f2fde64ee085c88b352c88312f5a24aafe4089a))
* Enhance testing framework and improve Jest configuration ([cb6badc](https://github.com/YonderUrik/buddy-budget/commit/cb6badce25a60a268914f0fa7ebc0f8a5aca42be))
* Improve test readability and structure across multiple files ([6d9e5df](https://github.com/YonderUrik/buddy-budget/commit/6d9e5dfcd2767ce5ddf69dace0e82dd6aef14448))
* Update Prisma mock implementation for improved type safety and clarity ([6f61161](https://github.com/YonderUrik/buddy-budget/commit/6f6116187eefc8050370e8fdfd6d0d2b3a88dacc))

### Continuous Integration

* Update GitHub Actions workflow to use npm instead of Bun ([2395b2f](https://github.com/YonderUrik/buddy-budget/commit/2395b2ff7a9044e680bc5f6f15fe7ded3105ef34))
* Update npm command in GitHub Actions workflow for dependency installation ([58a0a23](https://github.com/YonderUrik/buddy-budget/commit/58a0a235c85e60c9ff131914084ce3433038e29f))

## [2.1.0](https://github.com/YonderUrik/buddy-budget/compare/v2.0.0...v2.1.0) (2025-12-25)

### Features

* Add Privacy Policy and Terms of Service pages ([82ca8bd](https://github.com/YonderUrik/buddy-budget/commit/82ca8bd8acedcf399e8d4ae05dacad9ac8219267))

## [2.0.0](https://github.com/YonderUrik/buddy-budget/compare/v1.0.0...v2.0.0) (2025-12-25)

### ⚠ BREAKING CHANGES

* Add manual trigger support to release workflow

### chore

* Add manual trigger support to release workflow ([c432632](https://github.com/YonderUrik/buddy-budget/commit/c432632d82454fbef9711ef78c2de20e996a30bf))

## 1.0.0 (2025-12-25)

### ⚠ BREAKING CHANGES

* Set default working directory for deployment steps in GitHub Actions

### chore

* Set default working directory for deployment steps in GitHub Actions ([72d8add](https://github.com/YonderUrik/buddy-budget/commit/72d8add3d5493fe6e134466f88c0c40649aed43c))

### Features

* Add automated deployment workflow to Vercel and update README ([a35e086](https://github.com/YonderUrik/buddy-budget/commit/a35e0868927b96f4182b0366c70d2747e2d2761f))
* Add cookie consent management with vanilla-cookieconsent ([71bffec](https://github.com/YonderUrik/buddy-budget/commit/71bffec88ddce6c84ad8d3ae54a47f1232c12246))

### Bug Fixes

* Update Vercel deployment commands to use --cwd option ([6f7c9cb](https://github.com/YonderUrik/buddy-budget/commit/6f7c9cb303de221b95b50749135c518240dd2a2d))

### Documentation

* Update contributing guidelines and enhance README with security and privacy sections ([13f63cb](https://github.com/YonderUrik/buddy-budget/commit/13f63cb4ade8e6ac808e50af44e80ef0f24b4571))
* Update README to enhance visibility of CI workflows and add live demo link ([19623e4](https://github.com/YonderUrik/buddy-budget/commit/19623e42ac0395b64e62844a1c0e308284ca98bf))

### Styles

* Add z-index to error component for improved layering ([31571ab](https://github.com/YonderUrik/buddy-budget/commit/31571ab11cec51bc3637bc1754168079da099503))
* Update StockSearch component background color ([2acb75d](https://github.com/YonderUrik/buddy-budget/commit/2acb75df25c555ac0c013eee65f06a0d78836b48))

### Code Refactoring

* Consolidate formatting utilities and enhance Stock components ([563c73f](https://github.com/YonderUrik/buddy-budget/commit/563c73f8151a7157ffa3c572fcb6fc76cda57f19))
* Enhance Stock components with utility functions and hooks ([79674a5](https://github.com/YonderUrik/buddy-budget/commit/79674a5efb443bd273db2eb625be36874e72cf60))
* Enhance Vortex component with theme-based color handling and hue customization ([6b03030](https://github.com/YonderUrik/buddy-budget/commit/6b030308fec383f74707c0f15034e79a83825a00))
* Implement theme-based color handling in StockChart component ([2b1e339](https://github.com/YonderUrik/buddy-budget/commit/2b1e33926aa319a5ee846d44246dbdeb3188e1db))
* Rearrange Net Worth Page layout and enhance Net Worth Predictor data handling ([a091b33](https://github.com/YonderUrik/buddy-budget/commit/a091b33cd71b3bd6d689a2e99dac7f5a202b7abb))
* Remove unused no-stock selected section from FinancePage ([6a03548](https://github.com/YonderUrik/buddy-budget/commit/6a03548c9512de906f3b96b7e6f702cf8da66171))

### Tests

* Enhance Net Worth Predictor tests with edge cases and comprehensive coverage ([167ed24](https://github.com/YonderUrik/buddy-budget/commit/167ed24d51f12b2f5f448b7656dfaed1ea1ecc15))

### Continuous Integration

* Add semantic-release configuration and GitHub Actions workflow for automated releases ([ee8a919](https://github.com/YonderUrik/buddy-budget/commit/ee8a919523736578efa086f7d8f664d24c0ece3c))
* Add testing workflow and update release workflow ([f830f0e](https://github.com/YonderUrik/buddy-budget/commit/f830f0ea357aaf75a86451288a171bd2c46a9d47))
* Refactor workflows to streamline testing and release processes ([6f100d4](https://github.com/YonderUrik/buddy-budget/commit/6f100d4b4296bc23daf0880f0e1696ad78242ca5))
* Update CI workflow to use Node.js 20.x and remove build steps ([acf9f44](https://github.com/YonderUrik/buddy-budget/commit/acf9f44822dc4024b3bdd4c009745f2ac78de326))
* Update release workflow and dependencies ([d6c5d95](https://github.com/YonderUrik/buddy-budget/commit/d6c5d9572b6211796e7845f117e91c8797fd12e9))
* Update release workflow to use GitHub token for authentication ([397d529](https://github.com/YonderUrik/buddy-budget/commit/397d5292bd0b98e22ef834db2da518870e1ab4d6))
* Update workflows to use PAT for authentication and skip CI on specific commits ([07ebdce](https://github.com/YonderUrik/buddy-budget/commit/07ebdce5500f55fe6618c5990acdbbdd5a738d52))

## 1.0.0 (2025-12-24)

### ⚠ BREAKING CHANGES

* Set default working directory for deployment steps in GitHub Actions

### chore

* Set default working directory for deployment steps in GitHub Actions ([72d8add](https://github.com/YonderUrik/buddy-budget/commit/72d8add3d5493fe6e134466f88c0c40649aed43c))

### Features

* Add automated deployment workflow to Vercel and update README ([a35e086](https://github.com/YonderUrik/buddy-budget/commit/a35e0868927b96f4182b0366c70d2747e2d2761f))

### Bug Fixes

* Update Vercel deployment commands to use --cwd option ([6f7c9cb](https://github.com/YonderUrik/buddy-budget/commit/6f7c9cb303de221b95b50749135c518240dd2a2d))

### Documentation

* Update contributing guidelines and enhance README with security and privacy sections ([13f63cb](https://github.com/YonderUrik/buddy-budget/commit/13f63cb4ade8e6ac808e50af44e80ef0f24b4571))
* Update README to enhance visibility of CI workflows and add live demo link ([19623e4](https://github.com/YonderUrik/buddy-budget/commit/19623e42ac0395b64e62844a1c0e308284ca98bf))

### Styles

* Add z-index to error component for improved layering ([31571ab](https://github.com/YonderUrik/buddy-budget/commit/31571ab11cec51bc3637bc1754168079da099503))
* Update StockSearch component background color ([2acb75d](https://github.com/YonderUrik/buddy-budget/commit/2acb75df25c555ac0c013eee65f06a0d78836b48))

### Code Refactoring

* Consolidate formatting utilities and enhance Stock components ([563c73f](https://github.com/YonderUrik/buddy-budget/commit/563c73f8151a7157ffa3c572fcb6fc76cda57f19))
* Enhance Stock components with utility functions and hooks ([79674a5](https://github.com/YonderUrik/buddy-budget/commit/79674a5efb443bd273db2eb625be36874e72cf60))
* Enhance Vortex component with theme-based color handling and hue customization ([6b03030](https://github.com/YonderUrik/buddy-budget/commit/6b030308fec383f74707c0f15034e79a83825a00))
* Implement theme-based color handling in StockChart component ([2b1e339](https://github.com/YonderUrik/buddy-budget/commit/2b1e33926aa319a5ee846d44246dbdeb3188e1db))
* Rearrange Net Worth Page layout and enhance Net Worth Predictor data handling ([a091b33](https://github.com/YonderUrik/buddy-budget/commit/a091b33cd71b3bd6d689a2e99dac7f5a202b7abb))
* Remove unused no-stock selected section from FinancePage ([6a03548](https://github.com/YonderUrik/buddy-budget/commit/6a03548c9512de906f3b96b7e6f702cf8da66171))

### Tests

* Enhance Net Worth Predictor tests with edge cases and comprehensive coverage ([167ed24](https://github.com/YonderUrik/buddy-budget/commit/167ed24d51f12b2f5f448b7656dfaed1ea1ecc15))

### Continuous Integration

* Add semantic-release configuration and GitHub Actions workflow for automated releases ([ee8a919](https://github.com/YonderUrik/buddy-budget/commit/ee8a919523736578efa086f7d8f664d24c0ece3c))
* Add testing workflow and update release workflow ([f830f0e](https://github.com/YonderUrik/buddy-budget/commit/f830f0ea357aaf75a86451288a171bd2c46a9d47))
* Refactor workflows to streamline testing and release processes ([6f100d4](https://github.com/YonderUrik/buddy-budget/commit/6f100d4b4296bc23daf0880f0e1696ad78242ca5))
* Update CI workflow to use Node.js 20.x and remove build steps ([acf9f44](https://github.com/YonderUrik/buddy-budget/commit/acf9f44822dc4024b3bdd4c009745f2ac78de326))
* Update release workflow and dependencies ([d6c5d95](https://github.com/YonderUrik/buddy-budget/commit/d6c5d9572b6211796e7845f117e91c8797fd12e9))
* Update release workflow to use GitHub token for authentication ([397d529](https://github.com/YonderUrik/buddy-budget/commit/397d5292bd0b98e22ef834db2da518870e1ab4d6))
* Update workflows to use PAT for authentication and skip CI on specific commits ([07ebdce](https://github.com/YonderUrik/buddy-budget/commit/07ebdce5500f55fe6618c5990acdbbdd5a738d52))

## [1.0.1](https://github.com/YonderUrik/buddy-budget/compare/v1.0.0...v1.0.1) (2025-12-24)

### Documentation

* Update contributing guidelines and enhance README with security and privacy sections ([6d561fc](https://github.com/YonderUrik/buddy-budget/commit/6d561fc025baafbe19bfd72f6e04b1ae846ed0b4))

### Styles

* Add z-index to error component for improved layering ([fa2d88a](https://github.com/YonderUrik/buddy-budget/commit/fa2d88a62cb5d718102e622f5ace9b205368b777))
* Update StockSearch component background color ([6fcbacf](https://github.com/YonderUrik/buddy-budget/commit/6fcbacfbe29e4c6c96d597a3c45b15fe3757bd73))

### Code Refactoring

* Consolidate formatting utilities and enhance Stock components ([7a57642](https://github.com/YonderUrik/buddy-budget/commit/7a57642c2bf6c1b6a6324e3d1b040426b54c3b04))
* Enhance Stock components with utility functions and hooks ([73becfb](https://github.com/YonderUrik/buddy-budget/commit/73becfb635ee483cc9d3368c255cf4f2f0f610d5))
* Enhance Vortex component with theme-based color handling and hue customization ([f2c5e90](https://github.com/YonderUrik/buddy-budget/commit/f2c5e90e594206e0deebd8e38748bfa770ec979e))
* Implement theme-based color handling in StockChart component ([f5fbc07](https://github.com/YonderUrik/buddy-budget/commit/f5fbc07ca5a110afd712c7bcb79ab45fab46e262))
* Rearrange Net Worth Page layout and enhance Net Worth Predictor data handling ([a14120f](https://github.com/YonderUrik/buddy-budget/commit/a14120f3cfb44f41f45b2a7c9b020518c7e130d4))
* Remove unused no-stock selected section from FinancePage ([89d491b](https://github.com/YonderUrik/buddy-budget/commit/89d491b91c84f1b1b7eee23252a3380605bfb984))

### Tests

* Enhance Net Worth Predictor tests with edge cases and comprehensive coverage ([06743ca](https://github.com/YonderUrik/buddy-budget/commit/06743caa4be4261b212278d1fbae0260d866074c))

## 1.0.0 (2025-12-24)

### ⚠ BREAKING CHANGES

* Set default working directory for deployment steps in GitHub Actions

### chore

* Set default working directory for deployment steps in GitHub Actions ([f753d2a](https://github.com/YonderUrik/buddy-budget/commit/f753d2a813346bdce46899293e42c088e8b6b2d6))

### Features

* Add automated deployment workflow to Vercel and update README ([4d6f65c](https://github.com/YonderUrik/buddy-budget/commit/4d6f65cae9ac9fcb3a7fdd3d4844988e56ac5d32))

### Bug Fixes

* Update Vercel deployment commands to use --cwd option ([86aaf93](https://github.com/YonderUrik/buddy-budget/commit/86aaf93cad5bac252e5452030979e9e4ef44f961))

### Documentation

* Update README to enhance visibility of CI workflows and add live demo link ([9af877c](https://github.com/YonderUrik/buddy-budget/commit/9af877cd27e6a34f0d19ce10d408248a35106a38))

### Continuous Integration

* Add semantic-release configuration and GitHub Actions workflow for automated releases ([d0993e2](https://github.com/YonderUrik/buddy-budget/commit/d0993e2f3047ed40ba97766aa7ed331dbbc7826a))
* Add testing workflow and update release workflow ([1999331](https://github.com/YonderUrik/buddy-budget/commit/1999331ba2d193e50c2207d85de83e18fb2be00b))
* Refactor workflows to streamline testing and release processes ([c9008d2](https://github.com/YonderUrik/buddy-budget/commit/c9008d295f57483dc441d57657550129c6db5f05))
* Update CI workflow to use Node.js 20.x and remove build steps ([e3551a0](https://github.com/YonderUrik/buddy-budget/commit/e3551a0c88e3a45d57b11c8e434f39bccb989a8e))
* Update release workflow and dependencies ([1d1f104](https://github.com/YonderUrik/buddy-budget/commit/1d1f104cc4460fb6489f0aa0e33e9929bde7a023))
* Update release workflow to use GitHub token for authentication ([5b623d3](https://github.com/YonderUrik/buddy-budget/commit/5b623d3b838e8b6f0eb2181ba76c3df5cae882fb))
* Update workflows to use PAT for authentication and skip CI on specific commits ([925ecf8](https://github.com/YonderUrik/buddy-budget/commit/925ecf84f851ca7256aecf9829b61362091dbe41))

## 1.0.0 (2025-12-24)

### ⚠ BREAKING CHANGES

* Set default working directory for deployment steps in GitHub Actions

### chore

* Set default working directory for deployment steps in GitHub Actions ([f753d2a](https://github.com/YonderUrik/buddy-budget/commit/f753d2a813346bdce46899293e42c088e8b6b2d6))

### Features

* Add automated deployment workflow to Vercel and update README ([4d6f65c](https://github.com/YonderUrik/buddy-budget/commit/4d6f65cae9ac9fcb3a7fdd3d4844988e56ac5d32))

### Bug Fixes

* Update Vercel deployment commands to use --cwd option ([86aaf93](https://github.com/YonderUrik/buddy-budget/commit/86aaf93cad5bac252e5452030979e9e4ef44f961))

### Documentation

* Update README to enhance visibility of CI workflows and add live demo link ([9af877c](https://github.com/YonderUrik/buddy-budget/commit/9af877cd27e6a34f0d19ce10d408248a35106a38))

### Continuous Integration

* Add semantic-release configuration and GitHub Actions workflow for automated releases ([d0993e2](https://github.com/YonderUrik/buddy-budget/commit/d0993e2f3047ed40ba97766aa7ed331dbbc7826a))
* Add testing workflow and update release workflow ([1999331](https://github.com/YonderUrik/buddy-budget/commit/1999331ba2d193e50c2207d85de83e18fb2be00b))
* Refactor workflows to streamline testing and release processes ([c9008d2](https://github.com/YonderUrik/buddy-budget/commit/c9008d295f57483dc441d57657550129c6db5f05))
* Update CI workflow to use Node.js 20.x and remove build steps ([e3551a0](https://github.com/YonderUrik/buddy-budget/commit/e3551a0c88e3a45d57b11c8e434f39bccb989a8e))
* Update release workflow and dependencies ([1d1f104](https://github.com/YonderUrik/buddy-budget/commit/1d1f104cc4460fb6489f0aa0e33e9929bde7a023))
* Update release workflow to use GitHub token for authentication ([5b623d3](https://github.com/YonderUrik/buddy-budget/commit/5b623d3b838e8b6f0eb2181ba76c3df5cae882fb))
* Update workflows to use PAT for authentication and skip CI on specific commits ([925ecf8](https://github.com/YonderUrik/buddy-budget/commit/925ecf84f851ca7256aecf9829b61362091dbe41))
