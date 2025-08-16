"use client";

import { Dictionary } from "@/types/dictionary";
import { cn } from "@heroui/theme";



export function FeaturesSection({ dict }: { dict: Dictionary }) {
  const classNames = [
    "col-span-1 lg:col-span-4 border-b lg:border-r border-neutral-200/60 dark:border-neutral-800/60",
    "col-span-1 lg:col-span-2 border-b border-neutral-200/60 dark:border-neutral-800/60",
    "col-span-1 lg:col-span-3 lg:border-r border-neutral-200/60 dark:border-neutral-800/60",
    "col-span-1 lg:col-span-3 border-b lg:border-none border-neutral-200/60 dark:border-neutral-800/60",
  ];
  
  return (
    <div className="relative z-20 py-10 lg:py-40 max-w-7xl mx-auto">
      <div className="px-8">
        <h4 className="text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-medium text-black dark:text-white">
          {dict.landing.features.heading}
        </h4>

        <p className="text-sm lg:text-base  max-w-2xl  my-4 mx-auto text-neutral-500 text-center font-normal dark:text-neutral-300">
          {dict.landing.features.description}
        </p>
      </div>

      <div className="relative ">
        <div className="grid grid-cols-1 lg:grid-cols-6 mt-12 rounded-2xl xl:ring-1 xl:ring-inset xl:ring-neutral-200/60 dark:xl:ring-neutral-800/60">
          {dict.landing.features.items.map((feature, idx) => (
            <FeatureCard key={feature.title} className={classNames[idx % classNames.length]}>
              <FeatureTitle>{feature.title}</FeatureTitle>
              <FeatureDescription>{feature.desc}</FeatureDescription>
              <div className=" h-full w-full"><SkeletonOne image="/hero-illustration.svg" /></div>
            </FeatureCard>
          ))}
        </div>
      </div>
    </div>
  );
}
const FeatureCard = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn(`p-4 sm:p-8 relative overflow-hidden`, className)}>
      {children}
    </div>
  );
};

const FeatureTitle = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p className=" max-w-5xl mx-auto text-left tracking-tight text-black dark:text-white text-xl md:text-2xl md:leading-snug">
      {children}
    </p>
  );
};

const FeatureDescription = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p
      className={cn(
        "text-sm md:text-base  max-w-4xl text-left mx-auto",
        "text-neutral-500 text-center font-normal dark:text-neutral-300",
        "text-left max-w-sm mx-0 md:text-sm my-2"
      )}
    >
      {children}
    </p>
  );
};

export const SkeletonOne = ({ image }: { image: string }) => {
  return (
    <div className="relative flex py-8 px-2 gap-10 h-full">
      <div className="w-full  p-5  mx-auto bg-white dark:bg-neutral-900 shadow-2xl group h-full">
        <div className="flex flex-1 w-full h-full flex-col space-y-2  ">
          {/* TODO */}
          <img
            src={image}
            alt="header"
            width={800}
            height={800}
            className="h-full w-full object-cover object-left-top rounded-sm"
          />
        </div>
      </div>

      <div className="absolute bottom-0 z-40 inset-x-0 h-60 bg-gradient-to-t from-white dark:from-black via-white dark:via-black to-transparent w-full pointer-events-none" />
      <div className="absolute top-0 z-40 inset-x-0 h-60 bg-gradient-to-b from-white dark:from-black via-transparent to-transparent w-full pointer-events-none" />
    </div>
  );
};




