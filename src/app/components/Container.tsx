import React from "react";
import classnames from 'classnames/bind';

import styles from "./Container.module.scss";

type ContainerDepth = "0" | "1" | "2" | "3" | "4";
type OwnContainerProps = {
  depth?: ContainerDepth,
}

type NativeContainerProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  keyof OwnContainerProps
>;

type ContainerProps = NativeContainerProps & OwnContainerProps;

const cx = classnames.bind(styles);

const Container = ({ depth = "2", children, ...props }: ContainerProps) => (
  <section className={cx("container", `depth-${depth}`)} {...props}>
    { children }
  </section>
)

export default Container;
