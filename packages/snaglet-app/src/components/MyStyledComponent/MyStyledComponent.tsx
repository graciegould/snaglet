import React from 'react';
import styles from './MyStyledComponent.module.scss';

interface MyStyledComponentProps {
  title: string;
  children: React.ReactNode;
}

const MyStyledComponent: React.FC<MyStyledComponentProps> = ({ title, children }) => {
  return (
    <div className={styles.myComponent}>
      <h2>{title}</h2>
      <p>{children}</p>
      <p>
        This component uses <span className={styles.highlight}>SCSS Modules</span> for styling!
      </p>
    </div>
  );
};

export default MyStyledComponent; 