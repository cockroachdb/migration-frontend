import React from 'react';
import classnames from 'classnames/bind';
import { Heading, Logo } from "@cockroachlabs/ui-components";

import styles from "./TitleBar.module.scss";

const cx = classnames.bind(styles);

const TitleBar = () => (
  <header className={cx("title-bar")}>
    <Logo brand="cockroachdb" size="small" />
    <div className={cx("spacer")} />
    <Heading type="h3">SQL Migration Tool</Heading>
  </header>
);

export default TitleBar;
