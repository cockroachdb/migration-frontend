import classnames from "classnames/bind";

import styles from  "./Hr.module.scss";

const cx = classnames.bind(styles);

const Hr = () => (
  <hr className={cx("horizontal-rule")} />
);

export default Hr;
