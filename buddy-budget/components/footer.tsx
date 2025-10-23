import { Link } from "@heroui/link";
import { GithubIcon, Logo } from "@/components/icons";
import { siteConfig } from "@/config/site";

export const Footer = () => {
  return (
    <footer className="w-full border-t border-default-200 dark:border-default-100 bg-default-50/50 dark:bg-default-50/5 backdrop-blur-lg mt-20">
      <div className="container mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Logo />
              <span className="font-bold text-lg">Buddy Budget</span>
            </div>
            <p className="text-sm text-default-600 dark:text-default-400 max-w-md mb-4">
              Your Personal Finance Buddy. 100% open source and built with transparency in mind.
              Take control of your finances today.
            </p>
            <div className="flex items-center gap-4">
              <Link
                isExternal
                href={siteConfig.links.github}
                className="text-default-600 hover:text-default-900 dark:text-default-400 dark:hover:text-default-100 transition-colors"
              >
                <GithubIcon size={24} />
              </Link>
            </div>
          </div>

          {/* Features Links */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Features</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/net-worth"
                  className="text-sm text-default-600 hover:text-default-900 dark:text-default-400 dark:hover:text-default-100 transition-colors"
                >
                  Net Worth Predictor
                </Link>
              </li>
              <li>
                <Link
                  href="/finance"
                  className="text-sm text-default-600 hover:text-default-900 dark:text-default-400 dark:hover:text-default-100 transition-colors"
                >
                  Finance Tracker
                </Link>
              </li>
              <li>
                <Link
                  href="/#features"
                  className="text-sm text-default-600 hover:text-default-900 dark:text-default-400 dark:hover:text-default-100 transition-colors"
                >
                  All Features
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  isExternal
                  href={siteConfig.links.github}
                  className="text-sm text-default-600 hover:text-default-900 dark:text-default-400 dark:hover:text-default-100 transition-colors"
                >
                  GitHub
                </Link>
              </li>
              <li>
                <Link
                  isExternal
                  href={siteConfig.links.license}
                  className="text-sm text-default-600 hover:text-default-900 dark:text-default-400 dark:hover:text-default-100 transition-colors"
                >
                  License
                </Link>
              </li>
              <li>
                <Link
                  isExternal
                  href={siteConfig.links.contributing}
                  className="text-sm text-default-600 hover:text-default-900 dark:text-default-400 dark:hover:text-default-100 transition-colors"
                >
                  Contributing
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-sm text-default-600 hover:text-default-900 dark:text-default-400 dark:hover:text-default-100 transition-colors"
                >
                  About
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-default-200 dark:border-default-100 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-default-600 dark:text-default-400">
            © {new Date().getFullYear()} Buddy Budget. Open source under MIT License.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-default-600 dark:text-default-400">
              Made with
            </span>
            <span className="text-danger animate-pulse">♥</span>
            <span className="text-sm text-default-600 dark:text-default-400">
              by the community
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
